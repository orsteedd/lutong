<?php

namespace App\Services;

use App\Models\Approval;
use App\Models\Item;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class InventoryAdjustmentService
{
    public function __construct(private readonly ActivityLogger $activityLogger) {}

    public function adjust(string $sku, string $mode, float $quantity, ?int $userId = null): array
    {
        $normalizedSku = strtoupper(trim($sku));
        $normalizedMode = strtolower(trim($mode));

        if ($normalizedSku === '') {
            throw new RuntimeException('SKU is required.');
        }

        if ($normalizedMode !== 'deliver' && $normalizedMode !== 'wastage') {
            throw new RuntimeException('Mode must be Deliver or Wastage.');
        }

        if ($quantity <= 0) {
            throw new RuntimeException('Quantity must be greater than zero.');
        }

        return DB::transaction(function () use ($normalizedSku, $normalizedMode, $quantity, $userId): array {
            $item = Item::query()
                ->where('sku', $normalizedSku)
                ->lockForUpdate()
                ->first();

            if (!$item) {
                throw new RuntimeException('Item not found.');
            }

            $currentQuantity = (float) $item->quantity;
            $delta = $normalizedMode === 'deliver' ? $quantity : -$quantity;

            if ($currentQuantity + $delta < 0) {
                throw new RuntimeException('Adjustment would make stock negative after approval.');
            }

            $approval = Approval::query()->create([
                'module' => 'approvals',
                'reference_type' => 'manual_adjustment',
                'reference_id' => (int) $item->id,
                'status' => 'pending',
                'requested_by' => $userId,
                'notes' => 'Manual adjustment request requires admin approval.',
                'metadata' => [
                    'sku' => $item->sku,
                    'item_name' => $item->name,
                    'mode' => ucfirst($normalizedMode),
                    'quantity' => round($quantity, 3),
                    'delta' => round($delta, 3),
                    'previous_quantity' => round($currentQuantity, 3),
                    'projected_quantity' => round($currentQuantity + $delta, 3),
                    'unit' => $item->unit,
                ],
            ]);

            $this->activityLogger->log($userId, 'adjustment_requested', (int) $item->id, [
                'approval_id' => (int) $approval->id,
                'sku' => $item->sku,
                'mode' => ucfirst($normalizedMode),
                'quantity' => round($quantity, 3),
                'delta' => round($delta, 3),
                'previous_quantity' => round($currentQuantity, 3),
                'projected_quantity' => round($currentQuantity + $delta, 3),
            ]);

            return [
                'approval' => [
                    'id' => (int) $approval->id,
                    'status' => 'pending',
                    'type' => 'manual_adjustment',
                ],
                'item_snapshot' => [
                    'id' => (int) $item->id,
                    'sku' => $item->sku,
                    'name' => $item->name,
                    'quantity' => round($currentQuantity, 3),
                    'unit' => $item->unit,
                    'status' => $item->status,
                ],
                'requested_adjustment' => [
                    'mode' => ucfirst($normalizedMode),
                    'quantity' => round($quantity, 3),
                    'delta' => round($delta, 3),
                    'previous_quantity' => round($currentQuantity, 3),
                    'projected_quantity' => round($currentQuantity + $delta, 3),
                ],
            ];
        });
    }
}
