<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class HistoricalDataSeeder extends Seeder
{
    public function run(): void
    {
        $path = base_path('../data/cleaned_historis.csv');
        if (!is_file($path)) {
            $this->command->warn('cleaned_historis.csv belum tersedia; seeder historis dilewati.');
            return;
        }

        $handle = fopen($path, 'rb');
        if (!$handle) {
            throw new \RuntimeException('Gagal membuka cleaned_historis.csv.');
        }

        $header = fgetcsv($handle);
        $variantMeta = [];
        $variantPrices = [];
        $variantMap = [];
        $rows = [];
        $rowCount = 0;

        while (($values = fgetcsv($handle)) !== false) {
            if (count($values) !== count($header)) {
                continue;
            }
            $row = array_combine($header, $values);
            $rowCount++;

            $tanggal = $row['tanggal'];
            $namaProduk = trim((string) $row['nama_produk']);
            $variantName = trim((string) $row['variant']);
            $packSize = (int) $row['isi_pcs'];
            $qty = (int) $row['quantity'];
            $totalHarga = (int) $row['total_harga'];
            $hargaPerPack = (int) $row['harga_per_pack'];

            $key = $namaProduk."\0".$variantName."\0".$packSize;
            if (!isset($variantMap[$key])) {
                $productId = DB::table('products')->where('name', $namaProduk)->value('id');
                if (!$productId) {
                    $productId = DB::table('products')->insertGetId([
                        'name' => $namaProduk,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                $variantId = DB::table('product_variants')
                    ->where('product_id', $productId)
                    ->where('variant_name', $variantName)
                    ->where('pack_size', $packSize)
                    ->value('id');

                if (!$variantId) {
                    $variantId = DB::table('product_variants')->insertGetId([
                        'product_id' => $productId,
                        'variant_name' => $variantName,
                        'pack_size' => $packSize ?: null,
                        'size_label' => null,
                        'price' => 0,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
                $variantMap[$key] = $variantId;
                $variantMeta[$variantId] = [
                    'name' => $variantName,
                    'pack_size' => $packSize,
                ];
                $variantPrices[$variantId] = [];
            }

            $variantId = $variantMap[$key];
            $variantPrices[$variantId][] = $hargaPerPack;

            $sequence = str_pad((string) $rowCount, 4, '0', STR_PAD_LEFT);
            $dateCompact = str_replace('-', '', $tanggal);
            $code = 'HIS-'.$dateCompact.'-'.$sequence;

            $rows[] = [
                'code' => $code,
                'transaction_date' => $tanggal,
                'transacted_at' => null,
                'total_amount' => $totalHarga,
                'source' => 'historis',
                'basket_key' => 'D-'.$tanggal,
                'qty' => $qty,
                'variant_id' => $variantId,
                'unit_price' => $hargaPerPack,
                'subtotal' => $totalHarga,
            ];
        }
        fclose($handle);

        foreach ($variantPrices as $variantId => $prices) {
            $counts = array_count_values($prices);
            arsort($counts);
            $mode = (int) array_key_first($counts);
            DB::table('product_variants')->where('id', $variantId)->update([
                'price' => $mode,
                'updated_at' => now(),
            ]);
        }

        $chunks = array_chunk($rows, 500);
        foreach ($chunks as $chunk) {
            DB::transaction(function () use ($chunk) {
                foreach ($chunk as $row) {
                    $transactionId = DB::table('transactions')->insertGetId([
                        'code' => $row['code'],
                        'transaction_date' => $row['transaction_date'],
                        'transacted_at' => null,
                        'total_amount' => $row['total_amount'],
                        'source' => $row['source'],
                        'basket_key' => $row['basket_key'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    DB::table('transaction_items')->insert([
                        'transaction_id' => $transactionId,
                        'product_variant_id' => $row['variant_id'],
                        'qty' => $row['qty'],
                        'unit_price' => $row['unit_price'],
                        'subtotal' => $row['subtotal'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            });
        }

        $this->command->info('Historis diimpor: '.$rowCount.' transaksi.');
    }
}
