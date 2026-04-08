<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DashboardStatsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $inventoryHealth = (array) ($this['inventory_health'] ?? []);
        $todayAdjustments = (array) ($this['today_adjustments'] ?? []);

        return [
            'inventory_health' => [
                'critical' => (int) ($inventoryHealth['critical'] ?? 0),
                'normal' => (int) ($inventoryHealth['normal'] ?? 0),
                'total' => (int) ($inventoryHealth['total'] ?? 0),
            ],
            'today_adjustments' => [
                'scans' => (int) ($todayAdjustments['scans'] ?? 0),
                'wastage' => (float) ($todayAdjustments['wastage'] ?? 0),
                'transfers' => (float) ($todayAdjustments['transfers'] ?? 0),
                'total' => (float) ($todayAdjustments['total'] ?? 0),
                'date' => (string) ($todayAdjustments['date'] ?? ''),
            ],
        ];
    }
}
