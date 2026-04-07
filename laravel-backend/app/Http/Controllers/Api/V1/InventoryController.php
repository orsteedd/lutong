<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\InventoryItemResource;
use App\Models\Item;
use App\Services\InventoryCalculator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;

class InventoryController extends Controller
{
    public function __construct(private readonly InventoryCalculator $inventoryCalculator) {}

    public function index(): JsonResponse
    {
        $items = Item::query()
            ->with('category:id,name')
            ->orderBy('sku')
            ->get();

        return response()->json([
            'message' => 'Inventory items retrieved successfully.',
            'data' => [
                'items' => InventoryItemResource::collection($items),
            ],
        ]);
    }

    public function show(int $item_id): JsonResponse
    {
        try {
            $result = $this->inventoryCalculator->calculateForItem($item_id);
        } catch (ModelNotFoundException) {
            return response()->json([
                'message' => 'Item not found.',
            ], 404);
        }

        return response()->json([
            'message' => 'Inventory computed successfully.',
            'data' => $result,
        ]);
    }
}
