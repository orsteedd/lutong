<?php

namespace App\Services;

use App\Models\Adjustment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function lowStock(): array
    {
        return $this->remember('reports:low-stock', function (): array {
            $latestAuditTsSub = DB::table('inventory_logs as il')
                ->select('il.item_id', DB::raw('MAX(il.timestamp) as audit_ts'))
                ->where('il.status', 'approved')
                ->where('il.type', 'audit')
                ->groupBy('il.item_id');

            $latestAuditQtySub = DB::table('inventory_logs as ila')
                ->joinSub($latestAuditTsSub, 'lat', function ($join): void {
                    $join->on('ila.item_id', '=', 'lat.item_id')
                        ->on('ila.timestamp', '=', 'lat.audit_ts');
                })
                ->select('ila.item_id', DB::raw('MAX(ila.quantity) as base_qty'), 'lat.audit_ts')
                ->groupBy('ila.item_id', 'lat.audit_ts');

            $rows = DB::table('items as i')
                ->leftJoinSub($latestAuditQtySub, 'la', function ($join): void {
                    $join->on('la.item_id', '=', 'i.id');
                })
                ->leftJoin('inventory_logs as l', function ($join): void {
                    $join->on('l.item_id', '=', 'i.id')
                        ->where('l.status', '=', 'approved')
                        ->where(function ($q): void {
                            $q->whereNull('la.audit_ts')
                                ->orWhereColumn('l.timestamp', '>', 'la.audit_ts');
                        });
                })
                ->select(
                    'i.id',
                    'i.name',
                    'i.qr_code',
                    'i.safety_buffer',
                    DB::raw('COALESCE(MAX(la.base_qty), 0) as base_qty'),
                    DB::raw("COALESCE(SUM(CASE WHEN l.type = 'delivery' THEN l.quantity ELSE 0 END), 0) as delivery_qty"),
                    DB::raw("COALESCE(SUM(CASE WHEN l.type = 'wastage' THEN l.quantity ELSE 0 END), 0) as wastage_qty"),
                    DB::raw("COALESCE(SUM(CASE WHEN l.type = 'adjustment' THEN l.quantity ELSE 0 END), 0) as adjustment_qty")
                )
                ->groupBy('i.id', 'i.name', 'i.qr_code', 'i.safety_buffer')
                ->get();

            $items = [];
            foreach ($rows as $row) {
                $stock = max(
                    0,
                    round(
                        (float) $row->base_qty +
                            (float) $row->delivery_qty -
                            (float) $row->wastage_qty +
                            (float) $row->adjustment_qty,
                        3
                    )
                );

                $isLow = $stock <= (float) $row->safety_buffer;
                $alertLevel = $stock <= 0 ? 'critical' : ($isLow ? 'warning' : 'normal');

                $items[] = [
                    'item_id' => (int) $row->id,
                    'item_name' => $row->name,
                    'qr_code' => $row->qr_code,
                    'stock' => $stock,
                    'safety_buffer' => (float) $row->safety_buffer,
                    'is_low_stock' => $isLow,
                    'alert_level' => $alertLevel,
                ];
            }

            $redLineAlerts = array_values(array_filter($items, fn(array $item): bool => $item['is_low_stock']));

            return [
                'aggregated_inventory' => $items,
                'red_line_alerts' => $redLineAlerts,
                'usage_trends' => $this->usageTrends(7),
            ];
        });
    }

    public function dailySummary(?string $dateInput): array
    {
        $date = $dateInput ? CarbonImmutable::parse($dateInput)->startOfDay() : CarbonImmutable::now()->startOfDay();
        $cacheKey = 'reports:daily-summary:' . $date->toDateString();

        return $this->remember($cacheKey, function () use ($date): array {
            $start = $date->toDateTimeString();
            $end = $date->endOfDay()->toDateTimeString();

            $approvedLogs = DB::table('inventory_logs')
                ->where('status', 'approved')
                ->whereBetween('timestamp', [$start, $end]);

            $summary = (clone $approvedLogs)
                ->select(
                    DB::raw("COALESCE(SUM(CASE WHEN type = 'delivery' THEN quantity ELSE 0 END), 0) as delivery_qty"),
                    DB::raw("COALESCE(SUM(CASE WHEN type = 'wastage' THEN quantity ELSE 0 END), 0) as wastage_qty"),
                    DB::raw("COALESCE(SUM(CASE WHEN type = 'adjustment' THEN quantity ELSE 0 END), 0) as adjustment_qty"),
                    DB::raw("COALESCE(SUM(CASE WHEN type = 'transfer' THEN quantity ELSE 0 END), 0) as transfer_qty")
                )
                ->first();

            Adjustment::query()->updateOrCreate(
                ['summary_date' => $date->toDateString()],
                [
                    'scans' => (int) (clone $approvedLogs)->count(),
                    'wastage' => (float) ($summary->wastage_qty ?? 0),
                    'transfers' => (float) ($summary->transfer_qty ?? 0),
                ]
            );

            $pendingInventoryLogs = DB::table('inventory_logs')->where('status', 'pending')->count();
            $pendingDeliveries = DB::table('deliveries')->where('status', 'pending')->where('is_rejected', false)->count();
            $pendingAudits = DB::table('audits')->where('status', 'pending')->where('is_rejected', false)->count();
            $pendingTotal = $pendingInventoryLogs + $pendingDeliveries + $pendingAudits;

            $redLineAlerts = [];
            if ($pendingTotal > 0) {
                $redLineAlerts[] = [
                    'type' => 'pending_approvals',
                    'count' => $pendingTotal,
                    'details' => [
                        'inventory_logs' => $pendingInventoryLogs,
                        'deliveries' => $pendingDeliveries,
                        'audits' => $pendingAudits,
                    ],
                ];
            }

            return [
                'date' => $date->toDateString(),
                'aggregated_inventory' => [
                    'delivery_qty' => (float) ($summary->delivery_qty ?? 0),
                    'wastage_qty' => (float) ($summary->wastage_qty ?? 0),
                    'adjustment_qty' => (float) ($summary->adjustment_qty ?? 0),
                    'transfer_qty' => (float) ($summary->transfer_qty ?? 0),
                ],
                'red_line_alerts' => $redLineAlerts,
                'usage_trends' => $this->usageTrends(14),
            ];
        });
    }

    public function shrinkage(int $days): array
    {
        $days = max(1, min($days, 90));
        return $this->remember('reports:shrinkage:' . $days, function () use ($days): array {
            $start = CarbonImmutable::now()->subDays($days - 1)->startOfDay()->toDateTimeString();

            $itemShrinkage = DB::table('audit_items as ai')
                ->join('audits as a', 'a.id', '=', 'ai.audit_id')
                ->join('items as i', 'i.id', '=', 'ai.item_id')
                ->where('a.status', 'approved')
                ->where('a.created_at', '>=', $start)
                ->groupBy('ai.item_id', 'i.name', 'i.safety_buffer')
                ->select(
                    'ai.item_id',
                    'i.name',
                    'i.safety_buffer',
                    DB::raw('COALESCE(SUM(CASE WHEN ai.system_qty > ai.actual_qty THEN ai.system_qty - ai.actual_qty ELSE 0 END), 0) as shrinkage_qty'),
                    DB::raw('COALESCE(SUM(ai.system_qty), 0) as system_qty_total')
                )
                ->orderByDesc('shrinkage_qty')
                ->get();

            $aggregated = [];
            $redLineAlerts = [];

            foreach ($itemShrinkage as $row) {
                $shrinkageQty = round((float) $row->shrinkage_qty, 3);
                $systemTotal = max(0.001, (float) $row->system_qty_total);
                $shrinkageRate = round($shrinkageQty / $systemTotal, 4);

                $aggregated[] = [
                    'item_id' => (int) $row->item_id,
                    'item_name' => $row->name,
                    'shrinkage_qty' => $shrinkageQty,
                    'shrinkage_rate' => $shrinkageRate,
                ];

                if ($shrinkageQty > (float) $row->safety_buffer || $shrinkageRate >= 0.1) {
                    $redLineAlerts[] = [
                        'item_id' => (int) $row->item_id,
                        'item_name' => $row->name,
                        'shrinkage_qty' => $shrinkageQty,
                        'shrinkage_rate' => $shrinkageRate,
                        'threshold' => [
                            'safety_buffer' => (float) $row->safety_buffer,
                            'rate' => 0.1,
                        ],
                    ];
                }
            }

            $trendRows = DB::table('inventory_logs')
                ->where('status', 'approved')
                ->where('type', 'wastage')
                ->where('timestamp', '>=', $start)
                ->groupBy(DB::raw('DATE(timestamp)'))
                ->orderBy(DB::raw('DATE(timestamp)'))
                ->select(
                    DB::raw('DATE(timestamp) as day'),
                    DB::raw('COALESCE(SUM(quantity), 0) as wastage_qty')
                )
                ->get();

            $usageTrends = $trendRows->map(fn($row): array => [
                'day' => $row->day,
                'wastage_qty' => (float) $row->wastage_qty,
            ])->values()->all();

            return [
                'range_days' => $days,
                'aggregated_inventory' => $aggregated,
                'red_line_alerts' => $redLineAlerts,
                'usage_trends' => $usageTrends,
            ];
        });
    }

    public function stockSplit(): array
    {
        return $this->remember('reports:stock-split', function (): array {
            $rows = DB::table('items')
                ->select(
                    DB::raw("LOWER(COALESCE(location_type, 'unknown')) as location_type"),
                    DB::raw('COUNT(*) as item_count'),
                    DB::raw('COALESCE(SUM(quantity), 0) as total_quantity')
                )
                ->groupBy(DB::raw("LOWER(COALESCE(location_type, 'unknown'))"))
                ->get();

            $totals = [
                'main' => 0.0,
                'display' => 0.0,
                'other' => 0.0,
            ];

            foreach ($rows as $row) {
                $bucket = in_array($row->location_type, ['main', 'display'], true)
                    ? $row->location_type
                    : 'other';
                $totals[$bucket] += (float) $row->total_quantity;
            }

            $grandTotal = max(0.001, $totals['main'] + $totals['display'] + $totals['other']);

            return [
                'totals' => [
                    'main_qty' => round($totals['main'], 3),
                    'display_qty' => round($totals['display'], 3),
                    'other_qty' => round($totals['other'], 3),
                    'grand_total_qty' => round($totals['main'] + $totals['display'] + $totals['other'], 3),
                ],
                'percentages' => [
                    'main_pct' => round(($totals['main'] / $grandTotal) * 100, 2),
                    'display_pct' => round(($totals['display'] / $grandTotal) * 100, 2),
                    'other_pct' => round(($totals['other'] / $grandTotal) * 100, 2),
                ],
                'breakdown' => $rows->map(fn($row): array => [
                    'location_type' => $row->location_type,
                    'item_count' => (int) $row->item_count,
                    'total_quantity' => round((float) $row->total_quantity, 3),
                ])->values()->all(),
            ];
        });
    }

    public function auditAccuracy(int $days = 30): array
    {
        $days = max(1, min($days, 180));
        return $this->remember('reports:audit-accuracy:' . $days, function () use ($days): array {
            $start = CarbonImmutable::now()->subDays($days - 1)->startOfDay()->toDateTimeString();

            $summary = DB::table('audit_items as ai')
                ->join('audits as a', 'a.id', '=', 'ai.audit_id')
                ->where('a.created_at', '>=', $start)
                ->select(
                    DB::raw('COUNT(*) as total_rows'),
                    DB::raw("SUM(CASE WHEN ai.discrepancy_flag = 'match' THEN 1 ELSE 0 END) as matched_rows"),
                    DB::raw("SUM(CASE WHEN ai.discrepancy_flag != 'match' THEN 1 ELSE 0 END) as discrepancy_rows")
                )
                ->first();

            $totalRows = (int) ($summary->total_rows ?? 0);
            $matchedRows = (int) ($summary->matched_rows ?? 0);
            $discrepancyRows = (int) ($summary->discrepancy_rows ?? 0);
            $accuracy = $totalRows > 0 ? round(($matchedRows / $totalRows) * 100, 2) : 100.0;

            $byZone = DB::table('audit_items as ai')
                ->join('audits as a', 'a.id', '=', 'ai.audit_id')
                ->leftJoin('items as i', 'i.id', '=', 'ai.item_id')
                ->where('a.created_at', '>=', $start)
                ->groupBy('i.zone')
                ->select(
                    DB::raw("COALESCE(i.zone, 'Unassigned') as zone"),
                    DB::raw('COUNT(*) as total_rows'),
                    DB::raw("SUM(CASE WHEN ai.discrepancy_flag = 'match' THEN 1 ELSE 0 END) as matched_rows")
                )
                ->get();

            return [
                'range_days' => $days,
                'totals' => [
                    'audited_rows' => $totalRows,
                    'matched_rows' => $matchedRows,
                    'discrepancy_rows' => $discrepancyRows,
                    'accuracy_percent' => $accuracy,
                ],
                'by_zone' => $byZone->map(fn($row): array => [
                    'zone' => $row->zone,
                    'audited_rows' => (int) $row->total_rows,
                    'matched_rows' => (int) $row->matched_rows,
                    'accuracy_percent' => (int) $row->total_rows > 0
                        ? round(((int) $row->matched_rows / (int) $row->total_rows) * 100, 2)
                        : 100.0,
                ])->values()->all(),
            ];
        });
    }

    private function usageTrends(int $days): array
    {
        $days = max(1, min($days, 60));
        $start = CarbonImmutable::now()->subDays($days - 1)->startOfDay()->toDateTimeString();

        $rows = DB::table('inventory_logs')
            ->where('status', 'approved')
            ->where('timestamp', '>=', $start)
            ->groupBy(DB::raw('DATE(timestamp)'))
            ->orderBy(DB::raw('DATE(timestamp)'))
            ->select(
                DB::raw('DATE(timestamp) as day'),
                DB::raw("COALESCE(SUM(CASE WHEN type = 'delivery' THEN quantity ELSE 0 END), 0) as delivery_qty"),
                DB::raw("COALESCE(SUM(CASE WHEN type = 'wastage' THEN quantity ELSE 0 END), 0) as wastage_qty"),
                DB::raw("COALESCE(SUM(CASE WHEN type = 'adjustment' THEN quantity ELSE 0 END), 0) as adjustment_qty")
            )
            ->get();

        return $rows->map(fn($row): array => [
            'day' => $row->day,
            'delivery_qty' => (float) $row->delivery_qty,
            'wastage_qty' => (float) $row->wastage_qty,
            'adjustment_qty' => (float) $row->adjustment_qty,
            'net_qty' => round((float) $row->delivery_qty - (float) $row->wastage_qty + (float) $row->adjustment_qty, 3),
        ])->values()->all();
    }

    public function warmReportCache(string $report, array $params = []): void
    {
        if ($report === 'low-stock') {
            $this->lowStock();
            return;
        }

        if ($report === 'daily-summary') {
            $this->dailySummary($params['date'] ?? null);
            return;
        }

        if ($report === 'shrinkage') {
            $this->shrinkage((int) ($params['days'] ?? 30));
            return;
        }

        if ($report === 'stock-split') {
            $this->stockSplit();
            return;
        }

        if ($report === 'audit-accuracy') {
            $this->auditAccuracy((int) ($params['days'] ?? 30));
        }
    }

    private function remember(string $key, \Closure $callback): array
    {
        $ttl = max(30, (int) config('inventory.cache.ttl_seconds', 120));
        $store = config('inventory.cache.store');
        $cache = $store ? Cache::store($store) : Cache::store();

        return $cache->remember($key, $ttl, $callback);
    }
}
