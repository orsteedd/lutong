<?php

use App\Http\Controllers\Api\V1\ApprovalController;
use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AuditController;
use App\Http\Controllers\Api\V1\DeliveryController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\ScanController;
use App\Http\Controllers\Api\V1\SyncController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', static function () {
        return response()->json([
            'status' => 'ok',
            'service' => 'laravel-backend',
            'timestamp' => now()->toIso8601String(),
        ]);
    })->name('api.v1.health');

    Route::get('/logs', [ActivityLogController::class, 'index'])
        ->name('api.v1.logs.index');

    Route::post('/approvals/{type}/{id}', [ApprovalController::class, 'handle'])
        ->name('api.v1.approvals.handle');

    Route::post('/audits', [AuditController::class, 'store'])
        ->name('api.v1.audits.store');

    Route::post('/audits/{id}/submit', [AuditController::class, 'submit'])
        ->name('api.v1.audits.submit');

    Route::get('/deliveries', [DeliveryController::class, 'index'])
        ->name('api.v1.deliveries.index');

    Route::post('/deliveries', [DeliveryController::class, 'store'])
        ->name('api.v1.deliveries.store');

    Route::post('/deliveries/{id}/verify', [DeliveryController::class, 'verify'])
        ->name('api.v1.deliveries.verify');

    Route::get('/inventory/{item_id}', [InventoryController::class, 'show'])
        ->name('api.v1.inventory.show');

    Route::get('/reports/low-stock', [ReportController::class, 'lowStock'])
        ->name('api.v1.reports.low-stock');

    Route::get('/reports/daily-summary', [ReportController::class, 'dailySummary'])
        ->name('api.v1.reports.daily-summary');

    Route::get('/reports/shrinkage', [ReportController::class, 'shrinkage'])
        ->name('api.v1.reports.shrinkage');

    Route::post('/scan/submit', [ScanController::class, 'submit'])
        ->name('api.v1.scan.submit');

    Route::post('/sync', [SyncController::class, 'store'])
        ->name('api.v1.sync.store');
});
