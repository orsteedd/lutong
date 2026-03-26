<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Item;
use App\Services\DeliveryVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class DeliveryController extends Controller
{
    public function __construct(private readonly DeliveryVerificationService $deliveryVerificationService) {}

    public function index(): JsonResponse
    {
        $deliveries = Delivery::query()
            ->with([
                'deliveryItems:id,delivery_id,item_id,expected_qty,actual_qty,discrepancy_flag,verification_status',
                'deliveryItems.item:id,name,qr_code',
            ])
            ->latest('created_at')
            ->limit(100)
            ->get();

        return response()->json([
            'message' => 'Deliveries retrieved successfully.',
            'data' => $deliveries,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'supplier_name' => ['required', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_id' => ['required', 'integer', 'min:1'],
            'items.*.expected_qty' => ['required', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $items = $request->input('items', []);
        $uniqueItemIds = collect($items)->pluck('item_id')->map(fn($id) => (int) $id)->unique()->values();

        $existingIds = Item::query()->whereIn('id', $uniqueItemIds)->pluck('id')->map(fn($id) => (int) $id);
        if ($existingIds->count() !== $uniqueItemIds->count()) {
            return response()->json([
                'message' => 'One or more items do not exist.',
            ], 422);
        }

        $expectedByItem = [];
        foreach ($items as $row) {
            $itemId = (int) $row['item_id'];
            $expectedByItem[$itemId] = ($expectedByItem[$itemId] ?? 0.0) + (float) $row['expected_qty'];
        }

        $delivery = DB::transaction(function () use ($request, $expectedByItem): Delivery {
            $delivery = Delivery::query()->create([
                'supplier_name' => $request->string('supplier_name')->toString(),
                'status' => 'pending',
            ]);

            $rows = [];
            foreach ($expectedByItem as $itemId => $expectedQty) {
                $rows[] = [
                    'delivery_id' => $delivery->id,
                    'item_id' => (int) $itemId,
                    'expected_qty' => round($expectedQty, 3),
                    'actual_qty' => 0,
                    'discrepancy_flag' => null,
                    'discrepancy_qty' => 0,
                    'verification_status' => 'pending',
                    'verified_at' => null,
                ];
            }

            DB::table('delivery_items')->insert($rows);

            return $delivery;
        });

        return response()->json([
            'message' => 'Delivery created with expected items.',
            'data' => [
                'delivery_id' => $delivery->id,
                'status' => $delivery->status,
            ],
        ], 201);
    }

    public function verify(int $id, Request $request): JsonResponse
    {
        $delivery = Delivery::query()->find($id);
        if (!$delivery) {
            return response()->json([
                'message' => 'Delivery not found.',
            ], 404);
        }

        if ($delivery->is_rejected) {
            return response()->json([
                'message' => 'Delivery is rejected and cannot be verified.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'scanned_items' => ['required', 'array', 'min:1'],
            'scanned_items.*.item_id' => ['required', 'integer', 'min:1'],
            'scanned_items.*.actual_qty' => ['required', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $scannedItems = $request->input('scanned_items', []);
        $scannedItemIds = collect($scannedItems)->pluck('item_id')->map(fn($itemId) => (int) $itemId)->unique()->values();
        $existingScannedIds = Item::query()->whereIn('id', $scannedItemIds)->pluck('id')->map(fn($itemId) => (int) $itemId);
        if ($existingScannedIds->count() !== $scannedItemIds->count()) {
            return response()->json([
                'message' => 'One or more scanned items do not exist.',
            ], 422);
        }

        try {
            $report = $this->deliveryVerificationService->verify($delivery, $scannedItems);
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'message' => 'Delivery verification completed. Pending approval.',
            'data' => $report,
        ]);
    }
}
