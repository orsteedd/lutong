<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('delivery_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('delivery_id')->constrained('deliveries')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained('items')->cascadeOnUpdate()->restrictOnDelete();
            $table->decimal('expected_qty', 12, 3);
            $table->decimal('actual_qty', 12, 3);

            $table->unique(['delivery_id', 'item_id']);
            $table->index('item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_items');
    }
};
