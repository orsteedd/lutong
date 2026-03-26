<?php

namespace App\Services;

use App\Models\Item;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Throwable;

class SyncService
{
    private const ALLOWED_TYPES = [
        'delivery',
        'transfer',
        'wastage',
        'audit',
        'adjustment',
    ];

    public function sync(array $records): array
    {
        if (count($records) === 0) {
            return [
                'summary' => [
                    'total' => 0,
                    'success' => 0,
                    'failed' => 0,
                    'duplicates' => 0,
                    'conflicts' => 0,
                ],
                'results' => [],
            ];
        }

        $itemIds = [];
        foreach ($records as $record) {
            if (is_array($record) && isset($record['item_id']) && is_numeric($record['item_id'])) {
                $itemIds[] = (int) $record['item_id'];
            }
        }

        $itemIds = array_values(array_unique($itemIds));

        $existingItemIds = Item::query()
            ->whereIn('id', $itemIds)
            ->pluck('id')
            ->map(fn($id) => (int) $id)
            ->flip();

        $latestByItem = DB::table('inventory_logs')
            ->whereIn('item_id', $itemIds)
            ->groupBy('item_id')
            ->select('item_id', DB::raw('MAX(timestamp) AS latest_timestamp'))
            ->pluck('latest_timestamp', 'item_id');

        $incomingSyncRecordIds = [];
        foreach ($records as $record) {
            if (!is_array($record)) {
                continue;
            }

            $incomingSyncRecordIds[] = $this->deriveSyncRecordId($record);
        }

        $existingSynced = DB::table('inventory_logs')
            ->whereIn('sync_record_id', array_values(array_unique($incomingSyncRecordIds)))
            ->get(['id', 'sync_record_id'])
            ->keyBy('sync_record_id');

        $rowsToInsert = [];
        $resultsByIndex = [];
        $duplicates = 0;
        $conflicts = 0;

        foreach ($records as $index => $record) {
            if (!is_array($record)) {
                $resultsByIndex[$index] = [
                    'index' => $index,
                    'success' => false,
                    'error' => ['record' => ['Record must be an associative array.']],
                ];
                continue;
            }

            $validator = Validator::make($record, [
                'item_id' => ['required', 'integer', 'min:1'],
                'type' => ['required', Rule::in(self::ALLOWED_TYPES)],
                'quantity' => ['required', 'numeric', 'not_in:0'],
                'timestamp' => ['required', 'date'],
                'source' => ['nullable', 'string', 'max:100'],
                'sync_record_id' => ['nullable', 'string', 'max:120'],
            ]);

            if ($validator->fails()) {
                $resultsByIndex[$index] = [
                    'index' => $index,
                    'success' => false,
                    'error' => $validator->errors()->toArray(),
                ];
                continue;
            }

            $itemId = (int) $record['item_id'];
            if (!isset($existingItemIds[$itemId])) {
                $resultsByIndex[$index] = [
                    'index' => $index,
                    'success' => false,
                    'error' => ['item_id' => ['Item does not exist.']],
                ];
                continue;
            }

            try {
                $parsedTimestamp = CarbonImmutable::parse($record['timestamp']);
            } catch (Throwable) {
                $resultsByIndex[$index] = [
                    'index' => $index,
                    'success' => false,
                    'error' => ['timestamp' => ['Invalid timestamp format.']],
                ];
                continue;
            }

            $syncRecordId = $this->deriveSyncRecordId($record);
            if (isset($existingSynced[$syncRecordId])) {
                $duplicates++;
                $resultsByIndex[$index] = [
                    'index' => $index,
                    'success' => true,
                    'duplicate' => true,
                    'sync_record_id' => $syncRecordId,
                    'inventory_log_id' => (int) $existingSynced[$syncRecordId]->id,
                ];
                continue;
            }

            $latestTimestamp = $latestByItem[$itemId] ?? null;
            if ($latestTimestamp && $parsedTimestamp->lt(CarbonImmutable::parse($latestTimestamp))) {
                $conflicts++;
                $resultsByIndex[$index] = [
                    'index' => $index,
                    'success' => false,
                    'conflict' => 'timestamp_conflict',
                    'error' => [
                        'timestamp' => ['Record is older than the latest known record for this item.'],
                    ],
                    'latest_timestamp' => $latestTimestamp,
                ];
                continue;
            }

            $source = isset($record['source']) && is_string($record['source']) && $record['source'] !== ''
                ? $record['source']
                : 'sync';

            $payloadHash = hash('sha256', implode('|', [
                $itemId,
                (string) $record['type'],
                (string) ((float) $record['quantity']),
                $parsedTimestamp->toIso8601String(),
                $source,
            ]));

            $rowsToInsert[] = [
                'item_id' => $itemId,
                'type' => (string) $record['type'],
                'quantity' => (float) $record['quantity'],
                'source' => $source,
                'timestamp' => $parsedTimestamp->toDateTimeString(),
                'status' => 'pending',
                'sync_record_id' => $syncRecordId,
                'sync_payload_hash' => $payloadHash,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $resultsByIndex[$index] = [
                'index' => $index,
                'success' => true,
                'duplicate' => false,
                'sync_record_id' => $syncRecordId,
            ];
        }

        if (!empty($rowsToInsert)) {
            DB::transaction(function () use ($rowsToInsert): void {
                foreach (array_chunk($rowsToInsert, 1000) as $chunk) {
                    DB::table('inventory_logs')->insertOrIgnore($chunk);
                }
            });

            // Reconcile race-condition duplicates created by retries in parallel requests.
            $reconciledIds = DB::table('inventory_logs')
                ->whereIn('sync_record_id', array_column($rowsToInsert, 'sync_record_id'))
                ->get(['id', 'sync_record_id'])
                ->keyBy('sync_record_id');

            foreach ($resultsByIndex as $index => $result) {
                if (($result['success'] ?? false) !== true || !isset($result['sync_record_id'])) {
                    continue;
                }

                $syncRecordId = $result['sync_record_id'];
                $resolved = $reconciledIds[$syncRecordId] ?? null;
                if (!$resolved) {
                    $resultsByIndex[$index] = [
                        'index' => $index,
                        'success' => false,
                        'error' => ['database' => ['Failed to persist record. Retry safely.']],
                    ];
                    continue;
                }

                $resultsByIndex[$index]['inventory_log_id'] = (int) $resolved->id;
            }
        }

        ksort($resultsByIndex);
        $results = array_values($resultsByIndex);

        $successCount = count(array_filter($results, fn($row) => ($row['success'] ?? false) === true));
        $failedCount = count($results) - $successCount;

        return [
            'summary' => [
                'total' => count($records),
                'success' => $successCount,
                'failed' => $failedCount,
                'duplicates' => $duplicates,
                'conflicts' => $conflicts,
            ],
            'results' => $results,
        ];
    }

    private function deriveSyncRecordId(array $record): string
    {
        $rawId = isset($record['sync_record_id']) && is_string($record['sync_record_id'])
            ? trim($record['sync_record_id'])
            : '';

        if ($rawId !== '') {
            return $rawId;
        }

        return 'hash:' . hash('sha256', implode('|', [
            (int) ($record['item_id'] ?? 0),
            (string) ($record['type'] ?? ''),
            (string) ((float) ($record['quantity'] ?? 0)),
            (string) ($record['timestamp'] ?? ''),
            (string) ($record['source'] ?? 'sync'),
        ]));
    }
}
