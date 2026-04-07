<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('audit_sessions', function (Blueprint $table): void {
            if (!Schema::hasColumn('audit_sessions', 'zone')) {
                $table->string('zone', 100)->nullable()->after('status');
                $table->index('zone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('audit_sessions', function (Blueprint $table): void {
            if (Schema::hasColumn('audit_sessions', 'zone')) {
                $table->dropIndex('audit_sessions_zone_index');
                $table->dropColumn('zone');
            }
        });
    }
};
