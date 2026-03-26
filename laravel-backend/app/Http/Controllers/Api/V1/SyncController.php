<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    public function __construct(private readonly SyncService $syncService) {}

    public function store(Request $request): JsonResponse
    {
        $records = $request->input('records', []);

        if (!is_array($records)) {
            return response()->json([
                'message' => 'Invalid payload. records must be an array.',
            ], 422);
        }

        if (count($records) > 5000) {
            return response()->json([
                'message' => 'Too many records. Max 5000 per request.',
            ], 422);
        }

        $result = $this->syncService->sync($records);

        return response()->json([
            'message' => 'Sync processed with partial success support.',
            'data' => $result,
        ]);
    }
}
