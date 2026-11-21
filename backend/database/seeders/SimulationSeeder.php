<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SimulationSeeder extends Seeder
{
    public function run(): void
    {
        // Data simulasi untuk pengujian: deterministik dengan mt_srand(42).
        mt_srand(42);

        $variantStats = DB::table('transaction_items')
            ->join('transactions', 'transactions.id', '=', 'transaction_items.transaction_id')
            ->join('product_variants', 'product_variants.id', '=', 'transaction_items.product_variant_id')
            ->where('transactions.source', 'historis')
            ->select(
                'product_variants.id',
                'product_variants.price',
                DB::raw('SUM(transaction_items.qty * COALESCE(product_variants.pack_size, 1)) as volume')
            )
            ->groupBy('product_variants.id', 'product_variants.price')
            ->orderByDesc('volume')
            ->get();

        if ($variantStats->isEmpty()) {
            $variantStats = DB::table('product_variants')
                ->where('is_active', true)
                ->select('id', 'price', DB::raw('1 as volume'))
                ->get();
        }

        $variants = $variantStats->values();
        $today = Carbon::today('Asia/Jakarta');
        $transactions = [];

        for ($day = 29; $day >= 0; $day--) {
            $date = $today->copy()->subDays($day);
            for ($index = 1; $index <= 15; $index++) {
                $hour = $this->pickHour();
                $minute = mt_rand(0, 59);
                $second = mt_rand(0, 59);
                $transactedAt = $date->copy()->setTime($hour, $minute, $second);

                $itemCount = mt_rand(1, 4);
                $items = [];
                $selectedIds = [];

                $usePair = mt_rand(1, 100);
                if ($variants->count() >= 2 && $usePair <= 45) {
                    $items[] = $variants[0];
                    $items[] = $variants[1];
                    $selectedIds = [$variants[0]->id, $variants[1]->id];
                } elseif ($variants->count() >= 4 && $usePair <= 75) {
                    $items[] = $variants[2];
                    $items[] = $variants[3];
                    $selectedIds = [$variants[2]->id, $variants[3]->id];
                }

                while (count($items) < $itemCount) {
                    $selected = $this->weightedVariant($variants);
                    if (!in_array($selected->id, $selectedIds, true)) {
                        $items[] = $selected;
                        $selectedIds[] = $selected->id;
                    }
                }

                $code = 'SIM-'.$date->format('Ymd').'-'.str_pad((string) $index, 4, '0', STR_PAD_LEFT);
                $rows = [];
                $total = 0;
                foreach ($items as $variant) {
                    $qty = mt_rand(1, 3);
                    $unitPrice = (int) $variant->price;
                    $subtotal = $qty * $unitPrice;
                    $total += $subtotal;
                    $rows[] = [
                        'variant_id' => (int) $variant->id,
                        'qty' => $qty,
                        'unit_price' => $unitPrice,
                        'subtotal' => $subtotal,
                    ];
                }

                $transactions[] = [
                    'code' => $code,
                    'transaction_date' => $date->toDateString(),
                    'transacted_at' => $transactedAt,
                    'total_amount' => $total,
                    'source' => 'simulasi',
                    'basket_key' => $code,
                    'items' => $rows,
                ];
            }
        }

        foreach (array_chunk($transactions, 500) as $chunk) {
            DB::transaction(function () use ($chunk) {
                foreach ($chunk as $row) {
                    $transactionId = DB::table('transactions')->insertGetId([
                        'code' => $row['code'],
                        'transaction_date' => $row['transaction_date'],
                        'transacted_at' => $row['transacted_at'],
                        'total_amount' => $row['total_amount'],
                        'source' => $row['source'],
                        'basket_key' => $row['basket_key'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    foreach ($row['items'] as $item) {
                        DB::table('transaction_items')->insert([
                            'transaction_id' => $transactionId,
                            'product_variant_id' => $item['variant_id'],
                            'qty' => $item['qty'],
                            'unit_price' => $item['unit_price'],
                            'subtotal' => $item['subtotal'],
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
        }

        $this->command->info('Simulasi dibuat: '.count($transactions).' transaksi.');
    }

    private function weightedVariant($variants): object
    {
        $total = $variants->sum(function ($variant) {
            return max(1, (int) $variant->volume);
        });
        $pick = mt_rand(1, $total);
        $running = 0;
        foreach ($variants as $variant) {
            $running += max(1, (int) $variant->volume);
            if ($pick <= $running) {
                return $variant;
            }
        }
        return $variants->last();
    }

    private function pickHour(): int
    {
        $roll = mt_rand(1, 100);
        if ($roll <= 45) {
            return mt_rand(15, 17);
        }
        if ($roll <= 65) {
            return mt_rand(7, 8);
        }
        if ($roll <= 82) {
            return mt_rand(9, 14);
        }
        return mt_rand(18, 20);
    }
}
