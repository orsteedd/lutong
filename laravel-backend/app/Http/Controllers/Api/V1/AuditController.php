<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\Item;
use App\Services\AuditSubmissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AuditController extends Controller
{
    public function __construct(private readonly AuditSubmissionService $auditSubmissionService) {}

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
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

        $result = $this->auditSubmissionService->create($items);

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
