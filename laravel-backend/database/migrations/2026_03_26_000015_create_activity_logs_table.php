<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action_type', 100);
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamp('timestamp')->useCurrent();

            $table->index(['action_type', 'timestamp']);
            $table->index(['user_id', 'timestamp']);
            $table->index(['item_id', 'timestamp']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
