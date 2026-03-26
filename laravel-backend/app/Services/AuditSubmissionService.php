<?php

namespace App\Services;

use App\Models\Audit;
use Illuminate\Support\Facades\DB;

class AuditSubmissionService
{
    public function create(array $items): array
    {
        $systemByItem = [];
        $actualByItem = [];

        foreach ($items as $row) {
            $itemId = (int) $row['item_id'];
            $systemByItem[$itemId] = (float) $row['system_qty'];
            $actualByItem[$itemId] = (float) $row['actual_qty'];
        }

        $now = now();
        $rows = [];
        $discrepancies = [];
        $shortageCount = 0;
        $overageCount = 0;

        foreach ($systemByItem as $itemId => $systemQty) {
            $actualQty = (float) ($actualByItem[$itemId] ?? 0.0);
            $difference = round($actualQty - $systemQty, 3);

            if ($difference < 0) {
                $flag = 'shortage';
                $shortageCount++;
            } elseif ($difference > 0) {
                $flag = 'overage';
                $overageCount++;
            } else {
                $flag = 'match';
            }

            $rows[] = [
                'item_id' => $itemId,
                'system_qty' => round($systemQty, 3),
                'actual_qty' => round(max(0, $actualQty), 3),
                'discrepancy_flag' => $flag,
                'discrepancy_qty' => abs($difference),
                'verified_at' => $now,
            ];

            if ($flag !== 'match') {
                $discrepancies[] = [
                    'item_id' => $itemId,
                    'system_qty' => round($systemQty, 3),
                    'actual_qty' => round(max(0, $actualQty), 3),
                    'difference' => $difference,
                    'flag' => $flag,
                ];
            }
        }

        $audit = DB::transaction(function () use ($rows, $now): Audit {
            $audit = Audit::query()->create([
                'status' => 'pending',
                'created_at' => $now,
                'submitted_at' => $now,
            ]);

            foreach ($rows as &$row) {
                $row['audit_id'] = $audit->id;
            }
            unset($row);

            DB::table('audit_items')->insert($rows);

            return $audit;
        });

        return [
            'audit_id' => $audit->id,
            'status' => 'pending',
            'summary' => [
                'items_audited' => count($rows),
                'shortage_count' => $shortageCount,
                'overage_count' => $overageCount,
                'discrepancy_count' => count($discrepancies),
            ],
            'discrepancies' => $discrepancies,
        ];
    }
}
