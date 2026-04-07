<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table): void {
            if (!Schema::hasColumn('items', 'zone')) {
                $table->string('zone', 100)->nullable()->after('unit');
                $table->index('zone');
            }

            if (!Schema::hasColumn('items', 'location_type')) {
                $table->string('location_type', 100)->nullable()->after('zone');
                $table->index('location_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table): void {
            if (Schema::hasColumn('items', 'location_type')) {
                $table->dropIndex('items_location_type_index');
                $table->dropColumn('location_type');
            }

            if (Schema::hasColumn('items', 'zone')) {
                $table->dropIndex('items_zone_index');
                $table->dropColumn('zone');
            }
        });
    }
};
