<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateBusinessProfileRequest;
use App\Models\BusinessProfile;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;

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
            ->selectRaw('EXTRACT(HOUR FROM transacted_at)::int as jam, COUNT(*) as total')
            ->groupBy('jam')
            ->orderByDesc('total')
            ->limit(3)
            ->get();

        $profile->kesibukan = [
            'hari_tersibuk' => $busiestDay ? $busiestDay->hari : null,
            'jam_tersibuk' => $busiestHours->map(fn ($h) => [
                'jam' => sprintf('%02d:00', $h->jam),
                'jumlah' => (int) $h->total,
            ])->toArray(),
        ];

        return response()->json(['data' => $profile]);
    }

    public function update(UpdateBusinessProfileRequest $request): JsonResponse
    {
        $profile = BusinessProfile::firstOrCreate(
            ['id' => 1],
            ['business_name' => 'Usaha Saya']
        );

        $profile->update($request->validated());

        return response()->json([
            'message' => 'Profil usaha berhasil diperbarui.',
            'data' => $profile,
        ]);
    }
}
