<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('audits', function (Blueprint $table): void {
            if (!Schema::hasColumn('audits', 'audit_session_id')) {
                $table->unsignedBigInteger('audit_session_id')->nullable()->after('status');
                $table->index('audit_session_id');
            }

            if (!Schema::hasColumn('audits', 'zone_scope')) {
                $table->string('zone_scope', 100)->nullable()->after('audit_session_id');
                $table->index('zone_scope');
            }
        });
    }

    public function down(): void
    {
        Schema::table('audits', function (Blueprint $table): void {
            if (Schema::hasColumn('audits', 'zone_scope')) {
                $table->dropIndex('audits_zone_scope_index');
                $table->dropColumn('zone_scope');
            }

            if (Schema::hasColumn('audits', 'audit_session_id')) {
                $table->dropIndex('audits_audit_session_id_index');
                $table->dropColumn('audit_session_id');
            }
        });
    }
};
