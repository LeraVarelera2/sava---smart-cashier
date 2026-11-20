<?php

namespace App\Http\Controllers;

use App\Models\BusinessProfile;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BusinessProfileController extends Controller
{
    public function show(): JsonResponse
    {
        $profile = BusinessProfile::firstOrCreate(
            ['id' => 1],
            ['business_name' => 'Usaha Saya']
        );

        // Hari tersibuk (from all data)
        $busiestDay = Transaction::selectRaw("
                CASE EXTRACT(ISODOW FROM transaction_date)::int
                    WHEN 1 THEN 'Senin'
                    WHEN 2 THEN 'Selasa'
                    WHEN 3 THEN 'Rabu'
                    WHEN 4 THEN 'Kamis'
                    WHEN 5 THEN 'Jumat'
                    WHEN 6 THEN 'Sabtu'
                    WHEN 7 THEN 'Minggu'
                END as hari,
                COUNT(*) as total
            ")
            ->groupBy('hari')
            ->orderByDesc('total')
            ->first();

        // Jam tersibuk (top 3, only from data with transacted_at)
        $busiestHours = Transaction::whereNotNull('transacted_at')
            ->selectRaw("EXTRACT(HOUR FROM transacted_at)::int as jam, COUNT(*) as total")
            ->groupBy('jam')
            ->orderByDesc('total')
            ->limit(3)
            ->get();

        $profile->kesibukan = [
            'hari_tersibuk' => $busiestDay ? $busiestDay->hari : null,
            'jam_tersibuk' => $busiestHours->map(fn($h) => [
                'jam' => sprintf('%02d:00', $h->jam),
                'jumlah' => (int) $h->total,
            ])->toArray(),
        ];

        return response()->json(['data' => $profile]);
    }

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'business_name' => 'required|string|max:255',
            'business_type' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:500',
            'rt' => 'nullable|string|max:10',
            'rw' => 'nullable|string|max:10',
            'kelurahan' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
        ], [
            'business_name.required' => 'Nama usaha wajib diisi.',
        ]);

        $profile = BusinessProfile::firstOrCreate(
            ['id' => 1],
            ['business_name' => 'Usaha Saya']
        );

        $profile->update($request->only([
            'business_name', 'business_type', 'address',
            'rt', 'rw', 'kelurahan', 'phone',
        ]));

        return response()->json([
            'message' => 'Profil usaha berhasil diperbarui.',
            'data' => $profile,
        ]);
    }
}
