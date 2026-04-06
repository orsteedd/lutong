<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('username')->nullable()->unique()->after('name');
            });
        }

        if (!Schema::hasColumn('users', 'password')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('password')->nullable()->after('username');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'username') || Schema::hasColumn('users', 'password')) {
            Schema::table('users', function (Blueprint $table): void {
                if (Schema::hasColumn('users', 'username')) {
                    $table->dropColumn('username');
                }

                if (Schema::hasColumn('users', 'password')) {
                    $table->dropColumn('password');
                }
            });
        }
    }
};
