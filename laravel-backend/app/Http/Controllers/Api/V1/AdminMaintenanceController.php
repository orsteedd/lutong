<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class AdminMaintenanceController extends Controller
{
    public function backupDatabase(Request $request): JsonResponse
    {
        $admin = $this->resolveAdmin($request, 'requester_user_id');
        if ($admin instanceof JsonResponse) {
            return $admin;
        }

        $sourcePath = database_path('database.sqlite');
        if (!File::exists($sourcePath)) {
            return response()->json([
                'message' => 'SQLite database file not found.',
            ], 404);
        }

        $backupDir = storage_path('app/backups');
        File::ensureDirectoryExists($backupDir);

        $backupName = 'inventory-backup-' . now()->format('Ymd-His') . '.sqlite';
        $targetPath = $backupDir . DIRECTORY_SEPARATOR . $backupName;
        File::copy($sourcePath, $targetPath);

        return response()->json([
            'message' => 'Database backup created successfully.',
            'data' => [
                'backup_file' => $backupName,
                'backup_path' => $targetPath,
                'created_by' => $admin->id,
            ],
        ]);
    }

    public function resetSystem(Request $request): JsonResponse
    {
        $admin = $this->resolveAdmin($request, 'requester_user_id');
        if ($admin instanceof JsonResponse) {
            return $admin;
        }

        $validated = $request->validate([
            'confirmation' => ['required', 'string'],
        ]);

        if (trim($validated['confirmation']) !== 'RESET SYSTEM') {
            return response()->json([
                'message' => 'Invalid confirmation. Type RESET SYSTEM to continue.',
            ], 422);
        }

        DB::transaction(function (): void {
            DB::table('delivery_items')->delete();
            DB::table('audit_items')->delete();
            DB::table('inventory_logs')->delete();
            DB::table('approval_logs')->delete();
            DB::table('approvals')->delete();
            DB::table('activity_logs')->delete();
            DB::table('deliveries')->delete();
            DB::table('audits')->delete();
            DB::table('audit_sessions')->delete();
            DB::table('adjustments')->delete();
            DB::table('items')->delete();
            DB::table('categories')->delete();
        });

        return response()->json([
            'message' => 'System reset completed. Operational tables have been cleared.',
            'data' => [
                'performed_by' => $admin->id,
            ],
        ]);
    }

    private function resolveAdmin(Request $request, string $field): User|JsonResponse
    {
        $userId = (int) ($request->user()?->id ?? $request->input($field, 0));
        if ($userId <= 0) {
            return response()->json([
                'message' => $field . ' is required.',
            ], 422);
        }

        $user = User::query()->find($userId);
        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Only Admin users can access the admin module.',
            ], 403);
        }

        return $user;
    }
}
