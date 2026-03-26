<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('inventory_logs', function (Blueprint $table): void {
            $table->index(['status', 'type', 'timestamp'], 'idx_inventory_logs_status_type_ts');
            $table->index(['item_id', 'status', 'timestamp'], 'idx_inventory_logs_item_status_ts');
        });

        Schema::table('deliveries', function (Blueprint $table): void {
            $table->index(['status', 'is_rejected', 'created_at'], 'idx_deliveries_status_reject_created');
        });

        Schema::table('audits', function (Blueprint $table): void {
            $table->index(['status', 'is_rejected', 'created_at'], 'idx_audits_status_reject_created');
        });
    }

    public function down(): void
    {
        Schema::table('audits', function (Blueprint $table): void {
            $table->dropIndex('idx_audits_status_reject_created');
        });

        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropIndex('idx_deliveries_status_reject_created');
        });

        Schema::table('inventory_logs', function (Blueprint $table): void {
            $table->dropIndex('idx_inventory_logs_status_type_ts');
            $table->dropIndex('idx_inventory_logs_item_status_ts');
        });
    }
};
