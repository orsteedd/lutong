<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\InventoryAdjustmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryAdjustmentController extends Controller
{
    public function __construct(private readonly InventoryAdjustmentService $inventoryAdjustmentService) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sku' => ['required', 'string', 'max:50'],
            'mode' => ['required', 'string', 'max:20'],
            'quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        try {
            $result = $this->inventoryAdjustmentService->adjust(
                $validated['sku'],
                $validated['mode'],
                (float) $validated['quantity'],
                $request->user()?->id
            );
        } catch (\RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'message' => 'Adjustment request submitted and queued for admin approval.',
            'data' => $result,
        ], 202);
    }
}
