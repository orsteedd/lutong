<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthCheckController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            $pdo = DB::connection()->getPdo();

            return response()->json([
                'status' => 'healthy',
                'database' => 'connected',
                'pdo_connected' => $pdo !== null,
                'connection' => DB::connection()->getName(),
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Database disconnected',
                'database' => 'disconnected',
                'pdo_connected' => false,
            ], 500);
        }
    }
}
