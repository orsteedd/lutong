<?php

namespace App\Services;

use App\Models\Audit;
use App\Models\AuditSession;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class AuditSubmissionService
{
    public function create(array $items, ?int $sessionId = null, ?string $zoneScope = null): array
    {
        $session = null;
        if ($sessionId !== null) {
            $session = AuditSession::query()->find($sessionId);
            if (!$session) {
                throw new RuntimeException('Audit session not found.');
            }
        }

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

        $audit = DB::transaction(function () use ($rows, $now, $sessionId, $zoneScope): Audit {
            $audit = Audit::query()->create([
                'status' => 'pending',
                'audit_session_id' => $sessionId,
                'zone_scope' => $zoneScope,
                'created_at' => $now,
                'submitted_at' => $now,
            ]);

            foreach ($rows as &$row) {
                $row['audit_id'] = $audit->id;
            }
            unset($row);

            DB::table('audit_items')->insert($rows);

            foreach ($rows as $row) {
                if (($row['discrepancy_flag'] ?? 'match') === 'match') {
                    continue;
                }

                DB::table('activity_logs')->insert([
                    'user_id' => null,
                    'action_type' => 'audit_discrepancy_flagged',
                    'item_id' => $row['item_id'],
                    'metadata' => json_encode([
                        'audit_id' => $audit->id,
                        'audit_session_id' => $sessionId,
                        'zone_scope' => $zoneScope,
                        'system_qty' => $row['system_qty'],
                        'actual_qty' => $row['actual_qty'],
                        'discrepancy_flag' => $row['discrepancy_flag'],
                        'discrepancy_qty' => $row['discrepancy_qty'],
                    ], JSON_THROW_ON_ERROR),
                    'timestamp' => $now,
                ]);
            }

            return $audit;
        });

        if ($session && $session->status !== 'pending') {
            $session->status = 'pending';
            $session->save();
        }

        return [
            'audit_id' => $audit->id,
            'audit_session_id' => $session?->id,
            'zone_scope' => $zoneScope,
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
