<?php

namespace App\Http\Controllers;

use App\Models\ProductVariant;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array|min:1|max:50',
            'items.*.variant_id' => 'required|integer|exists:product_variants,id',
            'items.*.qty' => 'required|integer|min:1|max:999',
        ], [
            'items.required' => 'Item transaksi wajib diisi.',
            'items.min' => 'Minimal 1 item dalam transaksi.',
            'items.max' => 'Maksimal 50 item dalam transaksi.',
            'items.*.variant_id.required' => 'Varian produk wajib dipilih.',
            'items.*.variant_id.exists' => 'Varian produk tidak ditemukan.',
            'items.*.qty.required' => 'Jumlah wajib diisi.',
            'items.*.qty.min' => 'Jumlah minimal 1.',
            'items.*.qty.max' => 'Jumlah maksimal 999.',
        ]);

        // Validate all variants are active
        $variantIds = collect($request->items)->pluck('variant_id')->unique();
        $activeVariants = ProductVariant::whereIn('id', $variantIds)
            ->where('is_active', true)
            ->pluck('id');

        $inactiveIds = $variantIds->diff($activeVariants);
        if ($inactiveIds->isNotEmpty()) {
            return response()->json([
                'message' => 'Beberapa varian tidak aktif.',
                'errors' => ['items' => ['Varian dengan ID ' . $inactiveIds->implode(', ') . ' tidak aktif.']],
            ], 422);
        }

        $transaction = DB::transaction(function () use ($request) {
            $now = Carbon::now('Asia/Jakarta');
            $dateStr = $now->format('Ymd');

            // Generate sequential code for today
            $lastCode = Transaction::where('code', 'like', "TRX-{$dateStr}-%")
                ->orderByDesc('code')
                ->value('code');

            $seq = 1;
            if ($lastCode) {
                $parts = explode('-', $lastCode);
                $seq = (int) end($parts) + 1;
            }

            $code = sprintf('TRX-%s-%04d', $dateStr, $seq);

            $transaction = Transaction::create([
                'code' => $code,
                'transaction_date' => $now->toDateString(),
                'transacted_at' => $now,
                'total_amount' => 0,
                'source' => 'kasir',
                'basket_key' => $code,
            ]);

            $totalAmount = 0;

            foreach ($request->items as $item) {
                $variant = ProductVariant::find($item['variant_id']);
                $unitPrice = $variant->price;
                $subtotal = $unitPrice * $item['qty'];
                $totalAmount += $subtotal;

                TransactionItem::create([
                    'transaction_id' => $transaction->id,
                    'product_variant_id' => $item['variant_id'],
                    'qty' => $item['qty'],
                    'unit_price' => $unitPrice,
                    'subtotal' => $subtotal,
                ]);
            }

            $transaction->update(['total_amount' => $totalAmount]);

            return $transaction;
        });

        $transaction->load('items.variant');

        return response()->json([
            'message' => 'Transaksi berhasil disimpan.',
            'data' => $transaction,
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Transaction::with('items.variant')
            ->orderByDesc('transaction_date')
            ->orderByDesc('id');

        if ($request->has('date')) {
            $query->whereDate('transaction_date', $request->date);
        }

        if ($request->has('source') && $request->source !== 'semua') {
            $query->where('source', $request->source);
        }

        $transactions = $query->paginate(20);

        return response()->json($transactions);
    }
}
