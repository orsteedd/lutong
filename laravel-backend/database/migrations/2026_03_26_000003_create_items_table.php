<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table): void {
            $table->id();
            $table->string('sku')->unique();
            $table->string('name');
            $table->foreignId('category_id')->constrained('categories')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('unit')->default('pcs');
            $table->decimal('quantity', 12, 3)->default(0);
            $table->string('qr_code')->unique();
            $table->decimal('safety_buffer', 12, 3)->default(0);
            $table->string('status')->storedAs("case when quantity <= safety_buffer then 'critical' else 'normal' end");
            $table->timestamp('created_at')->useCurrent();

            $table->index('sku');
            $table->index('name');
            $table->index('category_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
