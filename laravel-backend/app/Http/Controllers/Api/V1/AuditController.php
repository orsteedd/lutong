<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\AuditSession;
use App\Models\Item;
use App\Services\AuditSubmissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AuditController extends Controller
{
    public function __construct(private readonly AuditSubmissionService $auditSubmissionService) {}

    public function startSession(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'zone' => ['required', 'string', 'max:100'],
            'created_by' => ['nullable', 'integer', 'min:1', 'exists:users,id'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $zone = trim((string) $request->input('zone'));
        $creatorId = (int) ($request->input('created_by') ?? 0) ?: null;

        $session = AuditSession::query()->create([
            'session_code' => 'AUD-' . now()->format('Ymd-His') . '-' . strtoupper(substr(md5((string) microtime(true)), 0, 4)),
            'status' => 'pending',
            'zone' => $zone,
            'created_by' => $creatorId,
            'started_at' => now(),
            'metadata' => [
                'zone_filter' => $zone,
            ],
        ]);

        $items = Item::query()
            ->when($zone !== '', fn($query) => $query->where('zone', $zone))
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'zone', 'quantity', 'unit', 'safety_buffer']);

        return response()->json([
            'message' => 'Audit session started.',
            'data' => [
                'session' => $session,
                'items' => $items,
            ],
        ], 201);
    }

    public function sessionProgress(int $sessionId): JsonResponse
    {
        $session = AuditSession::query()->find($sessionId);
        if (!$session) {
            return response()->json([
                'message' => 'Audit session not found.',
            ], 404);
        }

        $totalItems = Item::query()
            ->when($session->zone, fn($query) => $query->where('zone', $session->zone))
            ->count();

        $auditedDistinctItems = DB::table('audit_items as ai')
            ->join('audits as a', 'a.id', '=', 'ai.audit_id')
            ->where('a.audit_session_id', $session->id)
            ->distinct('ai.item_id')
            ->count('ai.item_id');

        $discrepancies = DB::table('audit_items as ai')
            ->join('audits as a', 'a.id', '=', 'ai.audit_id')
            ->where('a.audit_session_id', $session->id)
            ->where('ai.discrepancy_flag', '!=', 'match')
            ->count();

        $progressPct = $totalItems > 0
            ? round(($auditedDistinctItems / $totalItems) * 100, 2)
            : 0.0;

        return response()->json([
            'message' => 'Audit session progress retrieved.',
            'data' => [
                'session_id' => $session->id,
                'session_code' => $session->session_code,
                'zone' => $session->zone,
                'status' => $session->status,
                'progress' => [
                    'total_items' => $totalItems,
                    'audited_items' => $auditedDistinctItems,
                    'discrepancy_count' => $discrepancies,
                    'completion_percent' => $progressPct,
                ],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'audit_session_id' => ['nullable', 'integer', 'min:1', 'exists:audit_sessions,id'],
            'zone' => ['nullable', 'string', 'max:100'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_id' => ['required', 'integer', 'min:1'],
            'items.*.system_qty' => ['required', 'numeric', 'min:0'],
            'items.*.actual_qty' => ['required', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $items = $request->input('items', []);
        $itemIds = collect($items)->pluck('item_id')->map(fn($itemId) => (int) $itemId)->unique()->values();
        $existingIds = Item::query()->whereIn('id', $itemIds)->pluck('id')->map(fn($itemId) => (int) $itemId);
        if ($existingIds->count() !== $itemIds->count()) {
            return response()->json([
                'message' => 'One or more items do not exist.',
            ], 422);
        }

        $zone = $request->filled('zone') ? trim((string) $request->input('zone')) : null;
        $sessionId = $request->filled('audit_session_id') ? (int) $request->input('audit_session_id') : null;

        if ($zone !== null && $zone !== '') {
            $invalidIds = Item::query()
                ->whereIn('id', $itemIds)
                ->where(function ($query) use ($zone): void {
                    $query->whereNull('zone')->orWhere('zone', '!=', $zone);
                })
                ->pluck('id');

            if ($invalidIds->isNotEmpty()) {
                return response()->json([
                    'message' => 'Some audited items are outside the selected zone.',
                    'data' => [
                        'invalid_item_ids' => $invalidIds->values(),
                    ],
                ], 422);
            }
        }

        $result = $this->auditSubmissionService->create($items, $sessionId, $zone);

        return response()->json([
            'message' => 'Audit submitted. Pending approval.',
            'data' => $result,
        ], 201);
    }

    public function submit(int $id): JsonResponse
    {
        $audit = Audit::query()->find($id);
        if (!$audit) {
            return response()->json([
                'message' => 'Audit not found.',
            ], 404);
        }

        if ($audit->is_rejected) {
            return response()->json([
                'message' => 'Audit is rejected and cannot be submitted.',
            ], 422);
        }

        $audit->status = 'pending';
        $audit->submitted_at = now();
        $audit->save();

        return response()->json([
            'message' => 'Audit marked pending approval.',
            'data' => [
                'audit_id' => $audit->id,
                'status' => $audit->status,
                'submitted_at' => $audit->submitted_at,
            ],
        ]);
    }
}
