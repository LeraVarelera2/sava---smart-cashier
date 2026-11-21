<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTransactionRequest;
use App\Http\Requests\TransactionIndexRequest;
use App\Models\ProductVariant;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    public function store(StoreTransactionRequest $request): JsonResponse
    {
        $items = $request->validated()['items'];
        $transaction = DB::transaction(function () use ($request, $items) {
            $now = Carbon::now('Asia/Jakarta');
            $dateStr = $now->format('Ymd');

            DB::table('users')
                ->where('id', $request->user()->getAuthIdentifier())
                ->lockForUpdate()
                ->first();

            $variantIds = collect($items)->pluck('variant_id')->unique()->values();
            $variants = ProductVariant::whereIn('id', $variantIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $invalidIds = $variantIds->filter(function ($id) use ($variants) {
                return ! $variants->has($id) || ! $variants->get($id)->is_active;
            });
            if ($invalidIds->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'items' => ['Varian tidak ditemukan atau sudah tidak aktif: '.$invalidIds->implode(', ').'.'],
                ]);
            }

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

            foreach ($items as $item) {
                $variant = $variants->get($item['variant_id']);
                $unitPrice = $variant->price;
                $subtotal = $unitPrice * $item['qty'];
                $totalAmount += $subtotal;

                TransactionItem::create([
                    'transaction_id' => $transaction->id,
                    'product_variant_id' => $variant->id,
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

    public function index(TransactionIndexRequest $request): JsonResponse
    {
        $filters = $request->validated();
        $query = Transaction::with('items.variant')
            ->orderByDesc('transaction_date')
            ->orderByDesc('id');

        if (! empty($filters['date'])) {
            $query->whereDate('transaction_date', $filters['date']);
        }

        if (! empty($filters['source']) && $filters['source'] !== 'semua') {
            $query->where('source', $filters['source']);
        }

        $transactions = $query->paginate($filters['per_page'] ?? 20);

        return response()->json($transactions);
    }
}
