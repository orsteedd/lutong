<?php

namespace App\Services;

use App\Models\Approval;
use App\Models\ApprovalLog;
use App\Models\Audit;
use App\Models\Delivery;
use App\Models\Item;
use App\Models\InventoryLog;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ApprovalService
{
    public function __construct(private readonly ActivityLogger $activityLogger) {}

    public function approve(string $type, int $id, int $userId): array
    {
        return match ($type) {
            'delivery' => $this->approveDelivery($id, $userId),
            'audit' => $this->approveAudit($id, $userId),
            'adjustment' => $this->approveAdjustment($id, $userId),
            'request' => $this->approveRequest($id, $userId),
            default => throw new RuntimeException('Unsupported approval type.'),
        };
    }

    public function reject(string $type, int $id, int $userId): array
    {
        return match ($type) {
            'delivery' => $this->rejectDelivery($id, $userId),
            'audit' => $this->rejectAudit($id, $userId),
            'adjustment' => $this->rejectAdjustment($id, $userId),
            'request' => $this->rejectRequest($id, $userId),
            default => throw new RuntimeException('Unsupported approval type.'),
        };
    }

    private function approveRequest(int $id, int $userId): array
    {
        $approval = Approval::query()->find($id);
        if (!$approval) {
            throw new RuntimeException('Approval request not found.');
        }

        if ($approval->status !== 'pending') {
            return [
                'type' => 'request',
                'id' => $approval->id,
                'status' => $approval->status,
                'message' => 'Approval request already resolved.',
            ];
        }

        $result = DB::transaction(function () use ($approval, $userId): array {
            if ($approval->reference_type === 'manual_adjustment') {
                $item = Item::query()->lockForUpdate()->find((int) $approval->reference_id);
                if (!$item) {
                    throw new RuntimeException('Target item for manual adjustment was not found.');
                }

                $delta = (float) ($approval->metadata['delta'] ?? 0);
                if ($delta === 0.0) {
                    throw new RuntimeException('Manual adjustment delta is missing.');
                }

                $previous = (float) $item->quantity;
                $next = round($previous + $delta, 3);
                if ($next < 0) {
                    throw new RuntimeException('Approving this request would make stock negative.');
                }

                $item->quantity = $next;
                $item->save();

                InventoryLog::query()->create([
                    'item_id' => $item->id,
                    'type' => 'adjustment',
                    'quantity' => $delta,
                    'source' => 'approval-request:' . $approval->id,
                    'timestamp' => now(),
                    'status' => 'approved',
                ]);

                $approval->status = 'approved';
                $approval->approved_by = $userId;
                $approval->updated_at = now();
                $approval->save();

                $this->activityLogger->log($userId, 'approval_request_applied', (int) $item->id, [
                    'approval_id' => (int) $approval->id,
                    'reference_type' => $approval->reference_type,
                    'delta' => $delta,
                    'previous_quantity' => $previous,
                    'new_quantity' => $next,
                ]);

                return [
                    'reference_type' => $approval->reference_type,
                    'item_id' => (int) $item->id,
                    'previous_quantity' => $previous,
                    'new_quantity' => $next,
                ];
            }

            if ($approval->reference_type === 'delivery_discrepancy') {
                $deliveryId = (int) $approval->reference_id;
                $rows = DB::table('delivery_items')
                    ->where('delivery_id', $deliveryId)
                    ->where('discrepancy_flag', '!=', 'match')
                    ->get(['item_id', 'expected_qty', 'actual_qty', 'discrepancy_flag']);

                foreach ($rows as $row) {
                    $item = Item::query()->lockForUpdate()->find((int) $row->item_id);
                    if (!$item) {
                        continue;
                    }

                    $delta = round((float) $row->actual_qty - (float) $row->expected_qty, 3);
                    if ($delta === 0.0) {
                        continue;
                    }

                    $next = round((float) $item->quantity + $delta, 3);
                    if ($next < 0) {
                        throw new RuntimeException('Delivery discrepancy approval would make stock negative.');
                    }

                    $item->quantity = $next;
                    $item->save();

                    InventoryLog::query()->create([
                        'item_id' => $item->id,
                        'type' => 'adjustment',
                        'quantity' => $delta,
                        'source' => 'delivery-discrepancy:' . $deliveryId,
                        'timestamp' => now(),
                        'status' => 'approved',
                    ]);
                }

                $approval->status = 'approved';
                $approval->approved_by = $userId;
                $approval->updated_at = now();
                $approval->save();

                $this->activityLogger->log($userId, 'delivery_discrepancy_approved', null, [
                    'approval_id' => (int) $approval->id,
                    'delivery_id' => $deliveryId,
                    'line_count' => $rows->count(),
                ]);

                return [
                    'reference_type' => $approval->reference_type,
                    'delivery_id' => $deliveryId,
                    'line_count' => $rows->count(),
                ];
            }

            throw new RuntimeException('Unsupported request reference type.');
        });

        $this->writeApprovalLog('request', $approval->id, $userId, 'approved', [
            'reference_type' => $approval->reference_type,
        ]);

        return [
            'type' => 'request',
            'id' => $approval->id,
            'status' => 'approved',
            'data' => $result,
        ];
    }

    private function rejectRequest(int $id, int $userId): array
    {
        $approval = Approval::query()->find($id);
        if (!$approval) {
            throw new RuntimeException('Approval request not found.');
        }

        if ($approval->status !== 'pending') {
            return [
                'type' => 'request',
                'id' => $approval->id,
                'status' => $approval->status,
                'message' => 'Approval request already resolved.',
            ];
        }

        $approval->status = 'rejected';
        $approval->approved_by = $userId;
        $approval->updated_at = now();
        $approval->save();

        $this->writeApprovalLog('request', $approval->id, $userId, 'rejected', [
            'reference_type' => $approval->reference_type,
        ]);

        $this->activityLogger->log($userId, 'approval_request_rejected', null, [
            'approval_id' => (int) $approval->id,
            'reference_type' => $approval->reference_type,
        ]);

        return [
            'type' => 'request',
            'id' => $approval->id,
            'status' => 'rejected',
        ];
    }

    private function approveDelivery(int $id, int $userId): array
    {
        $delivery = Delivery::query()->find($id);
        if (!$delivery) {
            throw new RuntimeException('Delivery not found.');
        }

        if ($delivery->is_rejected) {
            throw new RuntimeException('Delivery is rejected and cannot be approved.');
        }

        if ($delivery->status === 'approved') {
            return [
                'type' => 'delivery',
                'id' => $delivery->id,
                'status' => 'approved',
                'inventory_logs_inserted' => 0,
                'message' => 'Delivery already approved.',
            ];
        }

        $verifiedItems = $delivery->deliveryItems()
            ->where('verification_status', 'verified')
            ->where('actual_qty', '>', 0)
            ->get(['item_id', 'actual_qty']);

        if ($verifiedItems->isEmpty()) {
            throw new RuntimeException('Delivery has no verified items to approve.');
        }

        $logs = [];
        $now = now();

        foreach ($verifiedItems as $deliveryItem) {
            $logs[] = [
                'item_id' => $deliveryItem->item_id,
                'type' => 'delivery',
                'quantity' => max(0, (float) $deliveryItem->actual_qty),
                'source' => 'delivery:' . $delivery->id,
                'timestamp' => $now,
                'status' => 'approved',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::transaction(function () use ($delivery, $logs, $now, $userId): void {
            if (!empty($logs)) {
                DB::table('inventory_logs')->insert($logs);
            }

            $delivery->status = 'approved';
            $delivery->is_rejected = false;
            $delivery->rejected_at = null;
            $delivery->save();

            $this->writeApprovalLog('delivery', $delivery->id, $userId, 'approved', [
                'inventory_logs_inserted' => count($logs),
            ]);

            $this->activityLogger->log($userId, 'approval_approved', null, [
                'type' => 'delivery',
                'id' => $delivery->id,
                'inventory_logs_inserted' => count($logs),
            ]);
        });

        return [
            'type' => 'delivery',
            'id' => $delivery->id,
            'status' => 'approved',
            'inventory_logs_inserted' => count($logs),
            'trace' => [
                'source_prefix' => 'delivery:' . $delivery->id,
                'approved_by_user_id' => $userId,
                'applied_at' => $now,
            ],
        ];
    }

    private function approveAudit(int $id, int $userId): array
    {
        $audit = Audit::query()->find($id);
        if (!$audit) {
            throw new RuntimeException('Audit not found.');
        }

        if ($audit->is_rejected) {
            throw new RuntimeException('Audit is rejected and cannot be approved.');
        }

        if ($audit->status === 'approved') {
            return [
                'type' => 'audit',
                'id' => $audit->id,
                'status' => 'approved',
                'inventory_logs_inserted' => 0,
                'message' => 'Audit already approved.',
            ];
        }

        $auditItems = DB::table('audit_items')
            ->where('audit_id', $audit->id)
            ->get(['item_id', 'actual_qty']);

        if ($auditItems->isEmpty()) {
            throw new RuntimeException('Audit has no items to approve.');
        }

        $logs = [];
        $now = now();
        foreach ($auditItems as $auditItem) {
            $logs[] = [
                'item_id' => $auditItem->item_id,
                'type' => 'audit',
                'quantity' => max(0, (float) $auditItem->actual_qty),
                'source' => 'audit:' . $audit->id,
                'timestamp' => $now,
                'status' => 'approved',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::transaction(function () use ($audit, $logs, $now, $userId): void {
            DB::table('inventory_logs')->insert($logs);

            $audit->status = 'approved';
            $audit->approved_at = $now;
            $audit->is_rejected = false;
            $audit->rejected_at = null;
            $audit->save();

            $this->writeApprovalLog('audit', $audit->id, $userId, 'approved', [
                'inventory_logs_inserted' => count($logs),
            ]);

            $this->activityLogger->log($userId, 'approval_approved', null, [
                'type' => 'audit',
                'id' => $audit->id,
                'inventory_logs_inserted' => count($logs),
            ]);

            if ($audit->audit_session_id) {
                $pendingInSession = DB::table('audits')
                    ->where('audit_session_id', $audit->audit_session_id)
                    ->where('status', 'pending')
                    ->where('is_rejected', false)
                    ->count();

                if ($pendingInSession === 0) {
                    DB::table('audit_sessions')
                        ->where('id', $audit->audit_session_id)
                        ->update([
                            'status' => 'approved',
                            'approved_by' => $userId,
                            'ended_at' => $now,
                            'updated_at' => $now,
                        ]);
                }
            }
        });

        return [
            'type' => 'audit',
            'id' => $audit->id,
            'status' => 'approved',
            'inventory_logs_inserted' => count($logs),
            'trace' => [
                'source_prefix' => 'audit:' . $audit->id,
                'approved_by_user_id' => $userId,
                'applied_at' => $now,
            ],
        ];
    }

    private function approveAdjustment(int $id, int $userId): array
    {
        $adjustment = InventoryLog::query()->find($id);
        if (!$adjustment || $adjustment->type !== 'adjustment') {
            throw new RuntimeException('Adjustment not found.');
        }

        if ($adjustment->status === 'rejected') {
            throw new RuntimeException('Adjustment is rejected and cannot be approved.');
        }

        if ($adjustment->status === 'approved') {
            return [
                'type' => 'adjustment',
                'id' => $adjustment->id,
                'status' => 'approved',
                'message' => 'Adjustment already approved.',
            ];
        }

        $adjustment->status = 'approved';
        $adjustment->save();

        $this->writeApprovalLog('adjustment', $adjustment->id, $userId, 'approved');
        $this->activityLogger->log($userId, 'adjustment_approved', $adjustment->item_id, [
            'adjustment_id' => $adjustment->id,
            'quantity' => (float) $adjustment->quantity,
        ]);

        return [
            'type' => 'adjustment',
            'id' => $adjustment->id,
            'status' => 'approved',
            'trace' => [
                'approved_by_user_id' => $userId,
                'applied_at' => now(),
            ],
        ];
    }

    private function rejectDelivery(int $id, int $userId): array
    {
        $delivery = Delivery::query()->find($id);
        if (!$delivery) {
            throw new RuntimeException('Delivery not found.');
        }

        if ($delivery->status === 'approved') {
            throw new RuntimeException('Approved delivery cannot be rejected.');
        }

        $now = now();
        $delivery->is_rejected = true;
        $delivery->rejected_at = $now;
        $delivery->save();

        $this->writeApprovalLog('delivery', $delivery->id, $userId, 'rejected');
        $this->activityLogger->log($userId, 'approval_rejected', null, [
            'type' => 'delivery',
            'id' => $delivery->id,
        ]);

        return [
            'type' => 'delivery',
            'id' => $delivery->id,
            'status' => 'rejected',
            'trace' => [
                'rejected_by_user_id' => $userId,
                'rejected_at' => $now,
            ],
        ];
    }

    private function rejectAudit(int $id, int $userId): array
    {
        $audit = Audit::query()->find($id);
        if (!$audit) {
            throw new RuntimeException('Audit not found.');
        }

        if ($audit->status === 'approved') {
            throw new RuntimeException('Approved audit cannot be rejected.');
        }

        $now = now();
        $audit->is_rejected = true;
        $audit->rejected_at = $now;
        $audit->save();

        $this->writeApprovalLog('audit', $audit->id, $userId, 'rejected');
        $this->activityLogger->log($userId, 'approval_rejected', null, [
            'type' => 'audit',
            'id' => $audit->id,
        ]);

        return [
            'type' => 'audit',
            'id' => $audit->id,
            'status' => 'rejected',
            'trace' => [
                'rejected_by_user_id' => $userId,
                'rejected_at' => $now,
            ],
        ];
    }

    private function rejectAdjustment(int $id, int $userId): array
    {
        $adjustment = InventoryLog::query()->find($id);
        if (!$adjustment || $adjustment->type !== 'adjustment') {
            throw new RuntimeException('Adjustment not found.');
        }

        if ($adjustment->status === 'approved') {
            throw new RuntimeException('Approved adjustment cannot be rejected.');
        }

        $adjustment->status = 'rejected';
        $adjustment->save();

        $this->writeApprovalLog('adjustment', $adjustment->id, $userId, 'rejected');
        $this->activityLogger->log($userId, 'adjustment_rejected', $adjustment->item_id, [
            'adjustment_id' => $adjustment->id,
            'quantity' => (float) $adjustment->quantity,
        ]);

        return [
            'type' => 'adjustment',
            'id' => $adjustment->id,
            'status' => 'rejected',
            'trace' => [
                'rejected_by_user_id' => $userId,
                'rejected_at' => now(),
            ],
        ];
    }

    private function writeApprovalLog(string $type, int $id, int $userId, string $action, array $metadata = []): void
    {
        ApprovalLog::query()->create([
            'approvable_type' => $type,
            'approvable_id' => $id,
            'user_id' => $userId,
            'action' => $action,
            'metadata' => $metadata,
            'created_at' => now(),
        ]);
    }
}
