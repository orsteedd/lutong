<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('audits', function (Blueprint $table): void {
            $table->timestamp('submitted_at')->nullable()->after('created_at');
            $table->timestamp('approved_at')->nullable()->after('submitted_at');

            $table->index('submitted_at');
            $table->index('approved_at');
        });

        Schema::table('audit_items', function (Blueprint $table): void {
            $table->enum('discrepancy_flag', ['match', 'shortage', 'overage'])
                ->nullable()
                ->after('actual_qty');
            $table->decimal('discrepancy_qty', 12, 3)->default(0)->after('discrepancy_flag');
            $table->timestamp('verified_at')->nullable()->after('discrepancy_qty');

            $table->index('discrepancy_flag');
            $table->index('verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('audit_items', function (Blueprint $table): void {
            $table->dropIndex(['discrepancy_flag']);
            $table->dropIndex(['verified_at']);
            $table->dropColumn(['discrepancy_flag', 'discrepancy_qty', 'verified_at']);
        });

        Schema::table('audits', function (Blueprint $table): void {
            $table->dropIndex(['submitted_at']);
            $table->dropIndex(['approved_at']);
            $table->dropColumn(['submitted_at', 'approved_at']);
        });
    }
};
