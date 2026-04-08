<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('adjustments', function (Blueprint $table): void {
            $table->id();
            $table->date('summary_date')->unique();
            $table->unsignedInteger('scans')->default(0);
            $table->decimal('wastage', 12, 3)->default(0);
            $table->decimal('transfers', 12, 3)->default(0);
            $table->timestamps();

            $table->index('summary_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('adjustments');
    }
};
