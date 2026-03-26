<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('delivery_items', function (Blueprint $table): void {
            $table->enum('discrepancy_flag', ['match', 'shortage', 'over-delivery', 'mismatch'])
                ->nullable()
                ->after('actual_qty');
            $table->decimal('discrepancy_qty', 12, 3)->default(0)->after('discrepancy_flag');
            $table->enum('verification_status', ['pending', 'verified'])->default('pending')->after('discrepancy_qty');
            $table->timestamp('verified_at')->nullable()->after('verification_status');

            $table->index('discrepancy_flag');
            $table->index('verification_status');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_items', function (Blueprint $table): void {
            $table->dropIndex(['discrepancy_flag']);
            $table->dropIndex(['verification_status']);
            $table->dropColumn(['discrepancy_flag', 'discrepancy_qty', 'verification_status', 'verified_at']);
        });
    }
};
