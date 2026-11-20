<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Models\TransactionItem;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private function getBaseQuery(Request $request)
    {
        $source = $request->input('source', 'semua');
        $range = $request->input('range', 'semua');

        $query = Transaction::query();

        if ($source !== 'semua') {
            $query->where('source', $source);
        }

        if ($range !== 'semua') {
            // Find the last transaction date for the selected source
            $subQuery = Transaction::query();
            if ($source !== 'semua') {
                $subQuery->where('source', $source);
            }
            $lastDate = $subQuery->max('transaction_date');

            if ($lastDate) {
                $lastDate = Carbon::parse($lastDate);
                $days = (int) $range;
                $startDate = $lastDate->copy()->subDays($days - 1);
                $query->where('transaction_date', '>=', $startDate->toDateString());
            }
        }

        return $query;
    }

    public function summary(Request $request): JsonResponse
    {
        $query = $this->getBaseQuery($request);

        $stats = $query->selectRaw('
            COALESCE(SUM(total_amount), 0) as total_omzet,
            COUNT(*) as jumlah_transaksi,
            COALESCE(AVG(total_amount), 0) as rata_rata_omzet
        ')->first();

        // Total pcs
        $transactionIds = (clone $query)->pluck('id');
        $totalPcs = TransactionItem::whereIn('transaction_id', $transactionIds)
            ->join('product_variants', 'transaction_items.product_variant_id', '=', 'product_variants.id')
            ->selectRaw('COALESCE(SUM(transaction_items.qty * COALESCE(product_variants.pack_size, 1)), 0) as total_pcs')
            ->value('total_pcs');

        return response()->json([
            'data' => [
                'total_omzet' => (int) $stats->total_omzet,
                'jumlah_transaksi' => (int) $stats->jumlah_transaksi,
                'total_pcs' => (int) $totalPcs,
                'rata_rata_omzet' => (int) round($stats->rata_rata_omzet),
            ],
        ]);
    }

    public function trend(Request $request): JsonResponse
    {
        $query = $this->getBaseQuery($request);
        $range = $request->input('range', 'semua');

        if ($range === 'semua') {
            // Per month for "semua"
            $data = (clone $query)
                ->selectRaw("TO_CHAR(transaction_date, 'YYYY-MM') as period, SUM(total_amount) as omzet, COUNT(*) as jumlah")
                ->groupBy('period')
                ->orderBy('period')
                ->get();
        } else {
            // Per day
            $data = (clone $query)
                ->selectRaw("transaction_date::text as period, SUM(total_amount) as omzet, COUNT(*) as jumlah")
                ->groupBy('transaction_date')
                ->orderBy('transaction_date')
                ->get();
        }

        return response()->json(['data' => $data]);
    }

    public function topProducts(Request $request): JsonResponse
    {
        $query = $this->getBaseQuery($request);
        $transactionIds = (clone $query)->pluck('id');

        $data = TransactionItem::whereIn('transaction_id', $transactionIds)
            ->join('product_variants', 'transaction_items.product_variant_id', '=', 'product_variants.id')
            ->selectRaw('
                product_variants.variant_name,
                SUM(transaction_items.qty * COALESCE(product_variants.pack_size, 1)) as total_pcs,
                SUM(transaction_items.subtotal) as total_omzet
            ')
            ->groupBy('product_variants.variant_name')
            ->orderByDesc('total_pcs')
            ->limit(10)
            ->get();

        return response()->json(['data' => $data]);
    }

    public function busyDays(Request $request): JsonResponse
    {
        $query = $this->getBaseQuery($request);

        $data = (clone $query)
            ->selectRaw("
                EXTRACT(ISODOW FROM transaction_date)::int as day_number,
                CASE EXTRACT(ISODOW FROM transaction_date)::int
                    WHEN 1 THEN 'Senin'
                    WHEN 2 THEN 'Selasa'
                    WHEN 3 THEN 'Rabu'
                    WHEN 4 THEN 'Kamis'
                    WHEN 5 THEN 'Jumat'
                    WHEN 6 THEN 'Sabtu'
                    WHEN 7 THEN 'Minggu'
                END as hari,
                ROUND(AVG(daily_total)) as rata_rata_omzet,
                ROUND(AVG(daily_count)) as rata_rata_transaksi
            ")
            ->fromSub(function ($sub) use ($query) {
                $sub->from((clone $query)->toBase())
                    ->selectRaw('transaction_date, SUM(total_amount) as daily_total, COUNT(*) as daily_count')
                    ->groupBy('transaction_date');
            }, 'daily')
            ->groupBy(DB::raw("EXTRACT(ISODOW FROM transaction_date)"))
            ->orderBy('day_number')
            ->get();

        return response()->json(['data' => $data]);
    }

    public function busyHours(Request $request): JsonResponse
    {
        $query = $this->getBaseQuery($request);

        $hasTimestamp = (clone $query)->whereNotNull('transacted_at')->exists();

        if (!$hasTimestamp) {
            return response()->json([
                'data' => [],
                'message' => 'Belum ada data jam. Jam tercatat dari transaksi kasir.',
            ]);
        }

        $data = (clone $query)
            ->whereNotNull('transacted_at')
            ->selectRaw("EXTRACT(HOUR FROM transacted_at)::int as jam, COUNT(*) as jumlah_transaksi")
            ->groupBy('jam')
            ->orderBy('jam')
            ->get();

        return response()->json(['data' => $data]);
    }
}
