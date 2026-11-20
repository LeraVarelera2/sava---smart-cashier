<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\BusinessProfile;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Create admin user
        User::firstOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@sava.test')],
            [
                'name' => 'Admin Sava',
                'password' => Hash::make(env('ADMIN_PASSWORD', 'Admin12345')),
            ]
        );

        // Create default business profile
        BusinessProfile::firstOrCreate(
            ['id' => 1],
            ['business_name' => 'Usaha Saya']
        );

        // Historical and simulation seeders will be called after data cleaning
        if (file_exists(base_path('../data/cleaned_historis.csv'))) {
            $this->call(HistoricalDataSeeder::class);
            $this->call(SimulationSeeder::class);
        }
    }
}
