<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('inventory_logs', function (Blueprint $table): void {
            $table->string('sync_record_id')->nullable()->after('status');
            $table->string('sync_payload_hash')->nullable()->after('sync_record_id');

            $table->unique('sync_record_id');
            $table->index('sync_payload_hash');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_logs', function (Blueprint $table): void {
            $table->dropUnique(['sync_record_id']);
            $table->dropIndex(['sync_payload_hash']);
            $table->dropColumn(['sync_record_id', 'sync_payload_hash']);
        });
    }
};
