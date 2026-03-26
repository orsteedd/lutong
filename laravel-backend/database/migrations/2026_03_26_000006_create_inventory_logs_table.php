<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('inventory_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('item_id')->constrained('items')->cascadeOnUpdate()->restrictOnDelete();
            $table->enum('type', ['delivery', 'transfer', 'wastage', 'audit', 'adjustment']);
            $table->decimal('quantity', 12, 3);
            $table->string('source');
            $table->timestamp('timestamp')->useCurrent();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->timestamps();

            $table->index(['item_id', 'timestamp']);
            $table->index(['status', 'timestamp']);
            $table->index(['type', 'timestamp']);
            $table->index('source');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_logs');
    }
};
