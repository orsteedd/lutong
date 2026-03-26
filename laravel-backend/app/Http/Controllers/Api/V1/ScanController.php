<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Services\ActivityLogger;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Throwable;

class ScanController extends Controller
{
    private const ALLOWED_TYPES = [
        'delivery',
        'transfer',
        'wastage',
        'audit',
        'adjustment',
    ];

    public function __construct(private readonly ActivityLogger $activityLogger) {}

    public function submit(Request $request): JsonResponse
    {
        $records = $request->input('records');

        if (!is_array($records)) {
            return response()->json([
                'message' => 'Invalid payload. "records" must be an array.',
            ], 422);
        }

        if (count($records) === 0) {
            return response()->json([
                'message' => 'No records provided.',
                'summary' => [
                    'total' => 0,
                    'accepted' => 0,
                    'rejected' => 0,
                ],
                'results' => [],
            ]);
        }

        if (count($records) > 5000) {
            return response()->json([
                'message' => 'Too many records. Max 5000 per request.',
            ], 422);
        }

        $itemIds = [];
        foreach ($records as $record) {
            if (is_array($record) && isset($record['item_id']) && is_numeric($record['item_id'])) {
                $itemIds[] = (int) $record['item_id'];
            }
        }

        $existingItemIds = Item::query()
            ->whereIn('id', array_values(array_unique($itemIds)))
            ->pluck('id')
            ->map(fn($id) => (int) $id)
            ->flip();

        $autoApproveTypes = config('inventory.auto_approve_types', []);

        $rowsToInsert = [];
        $activityEntries = [];
        $resultsByIndex = [];
        $actorId = $request->user()?->id;

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
                $parsedTimestamp = CarbonImmutable::parse($record['timestamp'])->toDateTimeString();
            } catch (Throwable) {
                $resultsByIndex[$index] = [
                    'index' => $index,
                    'success' => false,
                    'error' => ['timestamp' => ['Invalid timestamp format.']],
                ];
                continue;
            }

            $type = (string) $record['type'];
            $status = in_array($type, $autoApproveTypes, true) ? 'approved' : 'pending';

            $rowsToInsert[] = [
                'item_id' => $itemId,
                'type' => $type,
                'quantity' => (float) $record['quantity'],
                'source' => 'scan',
                'timestamp' => $parsedTimestamp,
                'status' => $status,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $activityEntries[] = [
                'user_id' => $actorId,
                'action_type' => 'scan_submitted',
                'item_id' => $itemId,
                'metadata' => [
                    'type' => $type,
                    'quantity' => (float) $record['quantity'],
                    'status' => $status,
                    'timestamp' => $parsedTimestamp,
                ],
            ];

            $resultsByIndex[$index] = [
                'index' => $index,
                'success' => true,
                'status' => $status,
            ];
        }

        if (!empty($rowsToInsert)) {
            try {
                DB::transaction(function () use ($rowsToInsert, $activityEntries): void {
                    foreach (array_chunk($rowsToInsert, 1000) as $chunk) {
                        DB::table('inventory_logs')->insert($chunk);
                    }

                    $this->activityLogger->logMany($activityEntries);
                });
            } catch (Throwable) {
                foreach ($resultsByIndex as $i => $result) {
                    if (($result['success'] ?? false) === true) {
                        $resultsByIndex[$i] = [
                            'index' => $i,
                            'success' => false,
                            'error' => ['database' => ['Insert failed. Retry request.']],
                        ];
                    }
                }

                ksort($resultsByIndex);
                $results = array_values($resultsByIndex);

                return response()->json([
                    'message' => 'Batch insert failed.',
                    'summary' => [
                        'total' => count($records),
                        'accepted' => 0,
                        'rejected' => count($records),
                    ],
                    'results' => $results,
                ], 500);
            }
        }

        ksort($resultsByIndex);
        $results = array_values($resultsByIndex);
        $accepted = count(array_filter($results, fn($result) => ($result['success'] ?? false) === true));

        return response()->json([
            'message' => 'Scan batch processed.',
            'summary' => [
                'total' => count($records),
                'accepted' => $accepted,
                'rejected' => count($records) - $accepted,
            ],
            'results' => $results,
        ]);
    }
}
