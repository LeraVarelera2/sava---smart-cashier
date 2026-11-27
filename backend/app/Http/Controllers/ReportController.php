<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReportSalesRequest;
use App\Http\Requests\ReportTransactionsRequest;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function sales(ReportSalesRequest $request): JsonResponse
    {
        $filters = $request->validated();
        $source = $filters['source'] ?? 'semua';
        $availableQuery = Transaction::query();

        if ($source !== 'semua') {
            $availableQuery->where('source', $source);
        }

        $available = (clone $availableQuery)
            ->selectRaw('MIN(transaction_date)::text as min_date, MAX(transaction_date)::text as max_date')
            ->first();

        if ($available->max_date === null) {
            $periodFrom = Carbon::now(config('app.timezone'))->startOfMonth()->toDateString();
            $periodTo = Carbon::now(config('app.timezone'))->endOfMonth()->toDateString();
        } elseif (isset($filters['from'], $filters['to'])) {
            $periodFrom = $filters['from'];
            $periodTo = $filters['to'];
        } else {
            $lastDate = Carbon::parse($available->max_date, config('app.timezone'));
            $periodFrom = $lastDate->copy()->startOfMonth()->toDateString();
            $periodTo = $lastDate->copy()->endOfMonth()->toDateString();
        }

        $transactions = $this->filteredTransactions($source)
            ->whereBetween('transaction_date', [$periodFrom, $periodTo]);

        $totals = (clone $transactions)
            ->selectRaw('COALESCE(SUM(total_amount), 0) as total_omzet, COUNT(*) as jumlah_transaksi')
            ->first();

        $totalPcs = DB::table('transaction_items')
            ->join('product_variants', 'transaction_items.product_variant_id', '=', 'product_variants.id')
            ->whereIn('transaction_items.transaction_id', (clone $transactions)->select('id'))
            ->sum(DB::raw('transaction_items.qty * COALESCE(product_variants.pack_size, 1)'));

        $dailyTotals = (clone $transactions)
            ->selectRaw('transaction_date::text as tanggal, COUNT(*) as jumlah_transaksi')
            ->selectRaw('COALESCE(SUM(total_amount), 0) as omzet')
            ->groupBy('transaction_date')
            ->orderBy('transaction_date')
            ->get();

        $dailyPcs = DB::table('transaction_items')
            ->join('transactions', 'transaction_items.transaction_id', '=', 'transactions.id')
            ->join('product_variants', 'transaction_items.product_variant_id', '=', 'product_variants.id')
            ->whereBetween('transactions.transaction_date', [$periodFrom, $periodTo])
            ->when($source !== 'semua', fn ($query) => $query->where('transactions.source', $source))
            ->selectRaw('transactions.transaction_date::text as tanggal')
            ->selectRaw('SUM(transaction_items.qty * COALESCE(product_variants.pack_size, 1)) as total_pcs')
            ->groupBy('transactions.transaction_date')
            ->pluck('total_pcs', 'tanggal');

        $daily = $dailyTotals->map(fn (object $row): array => [
            'tanggal' => $row->tanggal,
            'jumlah_transaksi' => (int) $row->jumlah_transaksi,
            'total_pcs' => (int) ($dailyPcs[$row->tanggal] ?? 0),
            'omzet' => (int) $row->omzet,
        ]);

        $topProducts = DB::table('transaction_items')
            ->join('product_variants', 'transaction_items.product_variant_id', '=', 'product_variants.id')
            ->whereIn('transaction_items.transaction_id', (clone $transactions)->select('id'))
            ->select('product_variants.variant_name')
            ->selectRaw('SUM(transaction_items.qty * COALESCE(product_variants.pack_size, 1)) as total_pcs')
            ->selectRaw('SUM(transaction_items.subtotal) as total_omzet')
            ->groupBy('product_variants.variant_name')
            ->orderByDesc('total_pcs')
            ->limit(10)
            ->get()
            ->map(fn (object $row): array => [
                'variant_name' => $row->variant_name,
                'total_pcs' => (int) $row->total_pcs,
                'total_omzet' => (int) $row->total_omzet,
            ]);

        $transactionCount = (int) $totals->jumlah_transaksi;
        $totalAmount = (int) $totals->total_omzet;

        return response()->json([
            'data' => [
                'period' => ['from' => $periodFrom, 'to' => $periodTo],
                'available' => [
                    'min_date' => $available->min_date,
                    'max_date' => $available->max_date,
                ],
                'summary' => [
                    'total_omzet' => $totalAmount,
                    'jumlah_transaksi' => $transactionCount,
                    'total_pcs' => (int) $totalPcs,
                    'rata_rata_omzet' => $transactionCount === 0
                        ? 0
                        : (int) round($totalAmount / $transactionCount),
                ],
                'daily' => $daily,
                'top_products' => $topProducts,
            ],
        ]);
    }

    public function transactions(ReportTransactionsRequest $request): JsonResponse
    {
        $filters = $request->validated();
        $source = $filters['source'] ?? 'semua';
        $query = $this->filteredTransactions($source)
            ->with(['items.variant.product'])
            ->whereBetween('transaction_date', [$filters['from'], $filters['to']]);

        if (! empty($filters['q'])) {
            $pattern = '%'.$filters['q'].'%';
            $query->where(function (Builder $query) use ($pattern): void {
                $query->where('code', 'ilike', $pattern)
                    ->orWhereHas('items.variant', function (Builder $variantQuery) use ($pattern): void {
                        $variantQuery->where('variant_name', 'ilike', $pattern)
                            ->orWhereHas('product', fn (Builder $productQuery) => $productQuery->where('name', 'ilike', $pattern));
                    });
            });
        }

        $paginator = $query
            ->orderByDesc('transaction_date')
            ->orderByRaw('transacted_at DESC NULLS LAST')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 20);

        $paginator->through(function (Transaction $transaction): array {
            $items = $transaction->items->map(function ($item): array {
                return [
                    'variant_name' => $item->variant->variant_name,
                    'pack_size' => $item->variant->pack_size,
                    'qty' => (int) $item->qty,
                    'subtotal' => (int) $item->subtotal,
                ];
            });

            $totalPcs = $transaction->items->sum(
                fn ($item): int => (int) $item->qty * ($item->variant->pack_size ?? 1)
            );
            $timestamp = $transaction->transacted_at;

            return [
                'id' => $transaction->id,
                'code' => $transaction->code,
                'tanggal' => $transaction->transaction_date->toDateString(),
                'jam' => $transaction->source === 'historis' || $timestamp === null
                    ? null
                    : $timestamp->timezone(config('app.timezone'))->format('H:i'),
                'source' => $transaction->source,
                'total_amount' => (int) $transaction->total_amount,
                'total_pcs' => $totalPcs,
                'items' => $items,
            ];
        });

        return response()->json($paginator);
    }

    private function filteredTransactions(string $source): Builder
    {
        $query = Transaction::query();

        if ($source !== 'semua') {
            $query->where('source', $source);
        }

        return $query;
    }
}
