<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'user_id' => ['nullable', 'integer', 'min:1', 'exists:users,id'],
            'action_type' => ['nullable', 'string', 'max:100'],
            'item_id' => ['nullable', 'integer', 'min:1', 'exists:items,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $query = ActivityLog::query();

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->query('user_id'));
        }

        if ($request->filled('action_type')) {
            $query->where('action_type', $request->query('action_type'));
        }

        if ($request->filled('item_id')) {
            $query->where('item_id', (int) $request->query('item_id'));
        }

        if ($request->filled('from')) {
            $query->where('timestamp', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->where('timestamp', '<=', $request->query('to'));
        }

        $limit = (int) $request->query('limit', 100);

        $logs = $query
            ->with([
                'user:id,name,role',
                'item:id,name,qr_code',
            ])
            ->orderByDesc('timestamp')
            ->limit($limit)
            ->get();

        return response()->json([
            'message' => 'Activity logs retrieved successfully.',
            'data' => $logs,
            'filters' => [
                'user_id' => $request->query('user_id'),
                'action_type' => $request->query('action_type'),
                'item_id' => $request->query('item_id'),
                'from' => $request->query('from'),
                'to' => $request->query('to'),
                'limit' => $limit,
            ],
        ]);
    }
}
