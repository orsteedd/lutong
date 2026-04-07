<?php

namespace App\Services;

use App\Models\Approval;
use App\Models\Delivery;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DeliveryVerificationService
{
    public function verify(Delivery $delivery, array $scannedItems): array
    {
        if (empty($scannedItems)) {
            throw new RuntimeException('No scanned items provided.');
        }

        $expectedRows = DB::table('delivery_items')
            ->where('delivery_id', $delivery->id)
            ->get(['item_id', 'expected_qty'])
            ->keyBy('item_id');

        if ($expectedRows->isEmpty()) {
            throw new RuntimeException('Delivery has no expected items to verify.');
        }

        $actualByItem = [];
        foreach ($scannedItems as $row) {
            $itemId = (int) $row['item_id'];
            $actualQty = (float) $row['actual_qty'];
            $actualByItem[$itemId] = ($actualByItem[$itemId] ?? 0.0) + $actualQty;
        }

        $upsertRows = [];
        $reportRows = [];
        $shortageCount = 0;
        $overDeliveryCount = 0;
        $mismatchCount = 0;

        foreach ($expectedRows as $itemId => $expectedRow) {
            $expectedQty = (float) $expectedRow->expected_qty;
            $actualQty = (float) ($actualByItem[$itemId] ?? 0.0);
            $discrepancy = round($actualQty - $expectedQty, 3);

            if ($actualQty < $expectedQty) {
                $flag = 'shortage';
                $shortageCount++;
                $mismatchCount++;
            } elseif ($actualQty > $expectedQty) {
                $flag = 'over-delivery';
                $overDeliveryCount++;
                $mismatchCount++;
            } else {
                $flag = 'match';
            }

            $upsertRows[] = [
                'delivery_id' => $delivery->id,
                'item_id' => (int) $itemId,
                'expected_qty' => $expectedQty,
                'actual_qty' => $actualQty,
                'discrepancy_flag' => $flag,
                'discrepancy_qty' => abs($discrepancy),
                'verification_status' => 'verified',
                'verified_at' => now(),
            ];

            $reportRows[] = [
                'item_id' => (int) $itemId,
                'expected_qty' => $expectedQty,
                'actual_qty' => $actualQty,
                'flag' => $flag,
                'difference' => $discrepancy,
            ];
        }

        // Unexpected scanned items are tracked as mismatch rows.
        foreach ($actualByItem as $itemId => $actualQty) {
            if ($expectedRows->has($itemId)) {
                continue;
            }

            $mismatchCount++;
            $overDeliveryCount++;

            $upsertRows[] = [
                'delivery_id' => $delivery->id,
                'item_id' => (int) $itemId,
                'expected_qty' => 0,
                'actual_qty' => $actualQty,
                'discrepancy_flag' => 'mismatch',
                'discrepancy_qty' => round($actualQty, 3),
                'verification_status' => 'verified',
                'verified_at' => now(),
            ];

            $reportRows[] = [
                'item_id' => (int) $itemId,
                'expected_qty' => 0.0,
                'actual_qty' => $actualQty,
                'flag' => 'mismatch',
                'difference' => round($actualQty, 3),
            ];
        }

        DB::transaction(function () use ($delivery, $upsertRows, $reportRows, $mismatchCount): void {
            DB::table('delivery_items')->upsert(
                $upsertRows,
                ['delivery_id', 'item_id'],
                ['actual_qty', 'discrepancy_flag', 'discrepancy_qty', 'verification_status', 'verified_at']
            );

            $delivery->status = 'pending';
            $delivery->save();

            if ($mismatchCount > 0) {
                Approval::query()->create([
                    'module' => 'approvals',
                    'reference_type' => 'delivery_discrepancy',
                    'reference_id' => (int) $delivery->id,
                    'status' => 'pending',
                    'notes' => 'Auto-flagged delivery mismatch pending admin approval.',
                    'metadata' => [
                        'delivery_id' => (int) $delivery->id,
                        'discrepancies' => array_values(array_filter(
                            $reportRows,
                            fn(array $row): bool => $row['flag'] !== 'match'
                        )),
                    ],
                ]);
            }
        });

        return [
            'delivery_id' => $delivery->id,
            'status' => 'pending',
            'summary' => [
                'items_verified' => count($reportRows),
                'shortage_count' => $shortageCount,
                'over_delivery_count' => $overDeliveryCount,
                'mismatch_count' => $mismatchCount,
            ],
            'discrepancies' => array_values(array_filter($reportRows, fn(array $row): bool => $row['flag'] !== 'match')),
            'all_items' => $reportRows,
        ];
    }
}
