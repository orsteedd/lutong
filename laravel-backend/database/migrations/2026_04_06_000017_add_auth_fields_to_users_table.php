<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (!Schema::hasColumn('users', 'username')) {
                $table->string('username', 120)->nullable()->after('name');
                $table->unique('username');
            }

            if (!Schema::hasColumn('users', 'password')) {
                $table->string('password')->nullable()->after('username');
            }

            if (!Schema::hasColumn('users', 'api_token')) {
                $table->string('api_token', 64)->nullable()->after('password');
                $table->unique('api_token');
            }

            if (!Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable()->after('api_token');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'last_login_at')) {
                $table->dropColumn('last_login_at');
            }

            if (Schema::hasColumn('users', 'api_token')) {
                $table->dropUnique('users_api_token_unique');
                $table->dropColumn('api_token');
            }

            if (Schema::hasColumn('users', 'password')) {
                $table->dropColumn('password');
            }

            if (Schema::hasColumn('users', 'username')) {
                $table->dropUnique('users_username_unique');
                $table->dropColumn('username');
            }
        });
    }
};
