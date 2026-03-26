<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->foreignId('category_id')->constrained('categories')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('qr_code')->unique();
            $table->decimal('safety_buffer', 12, 3)->default(0);
            $table->timestamp('created_at')->useCurrent();

            $table->index('name');
            $table->index('category_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
