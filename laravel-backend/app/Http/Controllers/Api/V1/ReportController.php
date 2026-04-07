<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateReportCacheJob;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reportService) {}

    public function lowStock(): JsonResponse
    {
        if (request()->boolean('async')) {
            GenerateReportCacheJob::dispatch('low-stock');

            return response()->json([
                'message' => 'Low-stock report generation queued.',
            ], 202);
        }

        $data = $this->reportService->lowStock();

        return response()->json([
            'message' => 'Low-stock report generated successfully.',
            'data' => $data,
        ]);
    }

    public function dailySummary(Request $request): JsonResponse
    {
        if ($request->boolean('async')) {
            GenerateReportCacheJob::dispatch('daily-summary', [
                'date' => $request->query('date'),
            ]);

            return response()->json([
                'message' => 'Daily summary generation queued.',
            ], 202);
        }

        try {
            $data = $this->reportService->dailySummary($request->query('date'));
        } catch (Throwable) {
            return response()->json([
                'message' => 'Invalid date format. Use YYYY-MM-DD.',
            ], 422);
        }

        return response()->json([
            'message' => 'Daily summary report generated successfully.',
            'data' => $data,
        ]);
    }

    public function shrinkage(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', 30);

        if ($request->boolean('async')) {
            GenerateReportCacheJob::dispatch('shrinkage', ['days' => $days]);

            return response()->json([
                'message' => 'Shrinkage report generation queued.',
            ], 202);
        }

        $data = $this->reportService->shrinkage($days);

        return response()->json([
            'message' => 'Shrinkage report generated successfully.',
            'data' => $data,
        ]);
    }

    public function stockSplit(Request $request): JsonResponse
    {
        if ($request->boolean('async')) {
            GenerateReportCacheJob::dispatch('stock-split');

            return response()->json([
                'message' => 'Stock split report generation queued.',
            ], 202);
        }

        $data = $this->reportService->stockSplit();

        return response()->json([
            'message' => 'Stock split report generated successfully.',
            'data' => $data,
        ]);
    }

    public function auditAccuracy(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', 30);

        if ($request->boolean('async')) {
            GenerateReportCacheJob::dispatch('audit-accuracy', ['days' => $days]);

            return response()->json([
                'message' => 'Audit accuracy report generation queued.',
            ], 202);
        }

        $data = $this->reportService->auditAccuracy($days);

        return response()->json([
            'message' => 'Audit accuracy report generated successfully.',
            'data' => $data,
        ]);
    }
}
