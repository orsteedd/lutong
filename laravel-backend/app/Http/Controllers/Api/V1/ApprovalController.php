<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ApprovalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class ApprovalController extends Controller
{
    public function __construct(private readonly ApprovalService $approvalService) {}

    public function handle(string $type, int $id, Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'action' => ['nullable', 'in:approve,reject'],
            'user_id' => ['nullable', 'integer', 'min:1', 'exists:users,id'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $actorId = (int) ($request->user()?->id ?? $request->input('user_id', 0));
        if ($actorId <= 0) {
            return response()->json([
                'message' => 'Approver user_id is required.',
            ], 422);
        }

        $action = strtolower((string) $request->input('action', 'approve'));

        try {
            if ($action === 'reject') {
                $result = $this->approvalService->reject($type, $id, $actorId);

                return response()->json([
                    'message' => 'Approval action processed.',
                    'data' => $result,
                ]);
            }

            $result = $this->approvalService->approve($type, $id, $actorId);
        } catch (RuntimeException $exception) {
            $statusCode = str_contains(strtolower($exception->getMessage()), 'not found') ? 404 : 422;

            return response()->json([
                'message' => $exception->getMessage(),
            ], $statusCode);
        }

        return response()->json([
            'message' => 'Approval action processed.',
            'data' => $result,
        ]);
    }
}
