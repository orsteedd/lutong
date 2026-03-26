<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('delivery_items', function (Blueprint $table): void {
            $table->index(['delivery_id', 'verification_status'], 'idx_delivery_items_delivery_verification');
            $table->index(['delivery_id', 'discrepancy_flag'], 'idx_delivery_items_delivery_discrepancy');
        });

        Schema::table('audit_items', function (Blueprint $table): void {
            $table->index(['audit_id', 'discrepancy_flag'], 'idx_audit_items_audit_discrepancy');
        });

        Schema::table('approval_logs', function (Blueprint $table): void {
            $table->index(['approvable_type', 'action', 'created_at'], 'idx_approval_logs_type_action_created');
        });
    }

    public function down(): void
    {
        Schema::table('approval_logs', function (Blueprint $table): void {
            $table->dropIndex('idx_approval_logs_type_action_created');
        });

        Schema::table('audit_items', function (Blueprint $table): void {
            $table->dropIndex('idx_audit_items_audit_discrepancy');
        });

        Schema::table('delivery_items', function (Blueprint $table): void {
            $table->dropIndex('idx_delivery_items_delivery_verification');
            $table->dropIndex('idx_delivery_items_delivery_discrepancy');
        });
    }
};
