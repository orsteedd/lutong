<?php

use App\Http\Controllers\Api\V1\ApprovalController;
use App\Http\Controllers\Api\V1\AdminMaintenanceController;
use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\AuditController;
use App\Http\Controllers\Api\V1\DeliveryController;
use App\Http\Controllers\Api\V1\HealthCheckController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\ScanController;
use App\Http\Controllers\Api\V1\SyncController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryAdjustmentController;
use Illuminate\Support\Facades\Route;

Route::get('/health-check', HealthCheckController::class)
    ->name('api.health-check');

Route::get('/dashboard/stats', DashboardController::class)
    ->name('api.dashboard.stats');

Route::post('/inventory/adjust', [InventoryAdjustmentController::class, 'store'])
    ->name('api.inventory.adjust');

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->name('api.v1.auth.login');

    Route::get('/health', HealthCheckController::class)
        ->name('api.v1.health');

    Route::get('/logs', [ActivityLogController::class, 'index'])
        ->name('api.v1.logs.index');

    Route::post('/approvals/{type}/{id}', [ApprovalController::class, 'handle'])
        ->name('api.v1.approvals.handle');

    Route::get('/approvals', [ApprovalController::class, 'index'])
        ->name('api.v1.approvals.index');

    Route::post('/audits', [AuditController::class, 'store'])
        ->name('api.v1.audits.store');

    Route::post('/audit-sessions/start', [AuditController::class, 'startSession'])
        ->name('api.v1.audit-sessions.start');

    Route::get('/audit-sessions/{sessionId}/progress', [AuditController::class, 'sessionProgress'])
        ->name('api.v1.audit-sessions.progress');

    Route::post('/audits/{id}/submit', [AuditController::class, 'submit'])
        ->name('api.v1.audits.submit');

    Route::get('/deliveries', [DeliveryController::class, 'index'])
        ->name('api.v1.deliveries.index');

    Route::post('/deliveries', [DeliveryController::class, 'store'])
        ->name('api.v1.deliveries.store');

    Route::post('/deliveries/{id}/verify', [DeliveryController::class, 'verify'])
        ->name('api.v1.deliveries.verify');

    Route::get('/inventory', [InventoryController::class, 'index'])
        ->name('api.v1.inventory.index');

    Route::get('/inventory/{item_id}', [InventoryController::class, 'show'])
        ->name('api.v1.inventory.show');

    Route::get('/reports/low-stock', [ReportController::class, 'lowStock'])
        ->name('api.v1.reports.low-stock');

    Route::get('/reports/daily-summary', [ReportController::class, 'dailySummary'])
        ->name('api.v1.reports.daily-summary');

    Route::get('/reports/shrinkage', [ReportController::class, 'shrinkage'])
        ->name('api.v1.reports.shrinkage');

    Route::get('/reports/stock-split', [ReportController::class, 'stockSplit'])
        ->name('api.v1.reports.stock-split');

    Route::get('/reports/audit-accuracy', [ReportController::class, 'auditAccuracy'])
        ->name('api.v1.reports.audit-accuracy');

    Route::post('/scan/submit', [ScanController::class, 'submit'])
        ->name('api.v1.scan.submit');

    Route::post('/sync', [SyncController::class, 'store'])
        ->name('api.v1.sync.store');

    Route::post('/admin/backup-database', [AdminMaintenanceController::class, 'backupDatabase'])
        ->name('api.v1.admin.backup-database');

    Route::post('/admin/reset-system', [AdminMaintenanceController::class, 'resetSystem'])
        ->name('api.v1.admin.reset-system');
});
