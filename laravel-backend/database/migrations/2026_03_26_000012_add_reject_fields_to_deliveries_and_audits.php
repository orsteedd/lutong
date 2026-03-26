<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->boolean('is_rejected')->default(false)->after('status');
            $table->timestamp('rejected_at')->nullable()->after('is_rejected');

            $table->index(['status', 'is_rejected']);
            $table->index('rejected_at');
        });

        Schema::table('audits', function (Blueprint $table): void {
            $table->boolean('is_rejected')->default(false)->after('status');
            $table->timestamp('rejected_at')->nullable()->after('is_rejected');

            $table->index(['status', 'is_rejected']);
            $table->index('rejected_at');
        });
    }

    public function down(): void
    {
        Schema::table('audits', function (Blueprint $table): void {
            $table->dropIndex(['status', 'is_rejected']);
            $table->dropIndex(['rejected_at']);
            $table->dropColumn(['is_rejected', 'rejected_at']);
        });

        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropIndex(['status', 'is_rejected']);
            $table->dropIndex(['rejected_at']);
            $table->dropColumn(['is_rejected', 'rejected_at']);
        });
    }
};
