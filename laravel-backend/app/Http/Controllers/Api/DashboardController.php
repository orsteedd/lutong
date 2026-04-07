<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DashboardStatsResource;
use App\Models\Adjustment;
use App\Models\Item;
use App\Services\ReportService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(private readonly ReportService $reportService) {}

    public function __invoke(): JsonResponse
    {
        $today = CarbonImmutable::now()->toDateString();

        $this->reportService->dailySummary($today);

        $inventoryHealth = [
            'critical' => Item::query()->where('status', 'critical')->count(),
            'normal' => Item::query()->where('status', '!=', 'critical')->count(),
        ];
        $inventoryHealth['total'] = $inventoryHealth['critical'] + $inventoryHealth['normal'];

        $dailySummary = Adjustment::query()->whereDate('summary_date', $today)->first();
        $scans = (int) ($dailySummary?->scans ?? 0);
        $wastage = (float) ($dailySummary?->wastage ?? 0);
        $transfers = (float) ($dailySummary?->transfers ?? 0);

        return response()->json([
            'message' => 'Dashboard stats retrieved successfully.',
            'data' => DashboardStatsResource::make([
                'inventory_health' => $inventoryHealth,
                'today_adjustments' => [
                    'scans' => $scans,
                    'wastage' => $wastage,
                    'transfers' => $transfers,
                    'total' => round($scans + $wastage + $transfers, 3),
                    'date' => $today,
                ],
            ]),
        ]);
    }
}
