<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::query()->updateOrCreate([
            'username' => 'admin',
        ], [
            'name' => 'Admin User',
            'role' => 'admin',
            'password' => Hash::make('admin1234'),
        ]);

        User::query()->updateOrCreate([
            'username' => 'staff',
        ], [
            'name' => 'Staff User',
            'role' => 'staff',
            'password' => Hash::make('staff1234'),
        ]);
    }
}
