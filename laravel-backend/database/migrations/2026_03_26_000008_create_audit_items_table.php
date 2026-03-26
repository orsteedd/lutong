<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('audit_id')->constrained('audits')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained('items')->cascadeOnUpdate()->restrictOnDelete();
            $table->decimal('system_qty', 12, 3);
            $table->decimal('actual_qty', 12, 3);

            $table->unique(['audit_id', 'item_id']);
            $table->index('item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_items');
    }
};
