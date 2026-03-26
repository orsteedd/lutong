<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('deliveries', function (Blueprint $table): void {
            $table->id();
            $table->string('supplier_name');
            $table->enum('status', ['pending', 'approved'])->default('pending');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deliveries');
    }
};
