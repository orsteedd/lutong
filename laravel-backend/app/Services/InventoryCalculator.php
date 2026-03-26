<?php

namespace App\Services;

use App\Models\InventoryLog;
use App\Models\Item;
use Illuminate\Support\Facades\Cache;

class InventoryCalculator
{
    public function calculateForItem(int $itemId): array
    {
        $ttl = max(30, (int) config('inventory.cache.ttl_seconds', 120));
        $store = config('inventory.cache.store');
        $cache = $store ? Cache::store($store) : Cache::store();

        return $cache->remember("inventory:item:{$itemId}", $ttl, function () use ($itemId): array {
            $item = Item::query()->findOrFail($itemId);

            $latestApprovedAudit = InventoryLog::query()
                ->approved()
                ->where('item_id', $itemId)
                ->where('type', 'audit')
                ->orderByDesc('timestamp')
                ->orderByDesc('id')
                ->first(['id', 'quantity', 'timestamp']);

            $baseStock = $latestApprovedAudit ? (float) $latestApprovedAudit->quantity : 0.0;

            $postAuditLogsQuery = InventoryLog::query()
                ->approved()
                ->where('item_id', $itemId);

            if ($latestApprovedAudit) {
                $postAuditLogsQuery->where('timestamp', '>', $latestApprovedAudit->timestamp);
            }

            $aggregate = $postAuditLogsQuery
                ->selectRaw("\n                    COALESCE(SUM(CASE WHEN type = 'delivery' THEN quantity ELSE 0 END), 0) AS delivery_total,\n                    COALESCE(SUM(CASE WHEN type = 'wastage' THEN quantity ELSE 0 END), 0) AS wastage_total,\n                    COALESCE(SUM(CASE WHEN type = 'adjustment' THEN quantity ELSE 0 END), 0) AS adjustment_total,\n                    COALESCE(SUM(CASE WHEN type = 'transfer' THEN quantity ELSE 0 END), 0) AS transfer_total\n                ")
                ->first();

            $deliveryTotal = (float) ($aggregate->delivery_total ?? 0);
            $wastageTotal = (float) ($aggregate->wastage_total ?? 0);
            $adjustmentTotal = (float) ($aggregate->adjustment_total ?? 0);

            // Transfers move stock between locations, so they do not change global item stock.
            $computedStock = $baseStock + $deliveryTotal - $wastageTotal + $adjustmentTotal;
            $finalStock = max(0.0, round($computedStock, 3));

            return [
                'item' => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'qr_code' => $item->qr_code,
                    'category_id' => $item->category_id,
                ],
                'stock' => $finalStock,
                'breakdown' => [
                    'base_from_audit' => round($baseStock, 3),
                    'delivery_additions' => round($deliveryTotal, 3),
                    'wastage_deductions' => round($wastageTotal, 3),
                    'adjustments' => round($adjustmentTotal, 3),
                    'transfer_net_effect' => 0,
                ],
                'audit_override' => [
                    'applied' => (bool) $latestApprovedAudit,
                    'log_id' => $latestApprovedAudit?->id,
                    'timestamp' => $latestApprovedAudit?->timestamp,
                ],
            ];
        });
    }
}
