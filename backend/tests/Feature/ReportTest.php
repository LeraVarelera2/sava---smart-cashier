<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_endpoints_require_authentication(): void
    {
        $this->getJson('/api/reports/sales')->assertUnauthorized();
        $this->getJson('/api/reports/transactions?from=2026-05-01&to=2026-05-31')->assertUnauthorized();
    }

    public function test_report_filters_validate_ranges_sources_search_and_page_sizes(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/reports/sales?from=2026-06-02&to=2026-06-01')
            ->assertUnprocessable()
            ->assertJsonPath('errors.to.0', 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.');
        $this->getJson('/api/reports/sales?from=2025-01-01&to=2026-01-02')
            ->assertUnprocessable()
            ->assertJsonPath('errors.to.0', 'Rentang tanggal maksimal 366 hari.');
        $this->getJson('/api/reports/sales?from=2025-01-01&to=2025-12-31')
            ->assertOk();
        $this->getJson('/api/reports/sales?from=2026-06-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['to']);
        $this->getJson('/api/reports/sales?source=lainnya')
            ->assertUnprocessable()
            ->assertJsonPath('errors.source.0', 'Sumber data tidak valid.');

        $base = '/api/reports/transactions?from=2026-05-01&to=2026-05-31';
        $this->getJson($base.'&source=lainnya')->assertUnprocessable()->assertJsonValidationErrors(['source']);
        $this->getJson($base.'&q='.str_repeat('a', 101))
            ->assertUnprocessable()
            ->assertJsonPath('errors.q.0', 'Pencarian maksimal 100 karakter.');
        $this->getJson($base.'&per_page=0')
            ->assertUnprocessable()
            ->assertJsonPath('errors.per_page.0', 'Jumlah data per halaman minimal 1.');
        $this->getJson($base.'&per_page=1001')
            ->assertUnprocessable()
            ->assertJsonPath('errors.per_page.0', 'Jumlah data per halaman maksimal 1000.');
        $this->getJson($base.'&from=2025-01-01&to=2026-01-02')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['to']);
        $this->getJson($base.'&from=2026-06-02&to=2026-06-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['to']);
        $this->getJson($base.'&per_page=1000')
            ->assertOk()
            ->assertJsonPath('per_page', 1000);
    }

    public function test_sales_summary_daily_and_top_products_aggregate_without_duplicate_transactions(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $bolen = $this->createVariant('Pisang Bolen', 'Cokelat', 5, 5000);
        $anotherCokelat = $this->createVariant('Bolen Lain', 'Cokelat', 2, 1000);
        $mix = $this->createVariant('Pisang Bolen', 'Mix', null, 4000);
        $this->createTransaction('HIST-1', '2026-05-29', 'historis', [
            ['variant' => $bolen, 'qty' => 2],
        ]);
        $this->createTransaction('HIST-2', '2026-05-30', 'historis', [
            ['variant' => $bolen, 'qty' => 1],
            ['variant' => $anotherCokelat, 'qty' => 1],
            ['variant' => $mix, 'qty' => 2],
        ]);
        $this->createTransaction('CASH-1', '2026-05-30', 'kasir', [
            ['variant' => $bolen, 'qty' => 3],
        ]);

        $this->getJson('/api/reports/sales?source=historis&from=2026-05-29&to=2026-05-30')
            ->assertOk()
            ->assertJsonPath('data.period.from', '2026-05-29')
            ->assertJsonPath('data.period.to', '2026-05-30')
            ->assertJsonPath('data.available.min_date', '2026-05-29')
            ->assertJsonPath('data.available.max_date', '2026-05-30')
            ->assertJsonPath('data.summary.total_omzet', 24000)
            ->assertJsonPath('data.summary.jumlah_transaksi', 2)
            ->assertJsonPath('data.summary.total_pcs', 19)
            ->assertJsonPath('data.summary.rata_rata_omzet', 12000)
            ->assertJsonPath('data.daily.0.tanggal', '2026-05-29')
            ->assertJsonPath('data.daily.0.jumlah_transaksi', 1)
            ->assertJsonPath('data.daily.0.total_pcs', 10)
            ->assertJsonPath('data.daily.0.omzet', 10000)
            ->assertJsonPath('data.daily.1.tanggal', '2026-05-30')
            ->assertJsonPath('data.daily.1.total_pcs', 9)
            ->assertJsonPath('data.daily.1.omzet', 14000)
            ->assertJsonPath('data.top_products.0.variant_name', 'Cokelat')
            ->assertJsonPath('data.top_products.0.total_pcs', 17)
            ->assertJsonPath('data.top_products.0.total_omzet', 16000)
            ->assertJsonPath('data.top_products.1.variant_name', 'Mix')
            ->assertJsonPath('data.top_products.1.total_pcs', 2);

        $this->getJson('/api/reports/sales?source=kasir&from=2026-05-30&to=2026-05-30')
            ->assertOk()
            ->assertJsonPath('data.summary.total_omzet', 15000)
            ->assertJsonPath('data.summary.jumlah_transaksi', 1)
            ->assertJsonPath('data.summary.total_pcs', 15);
    }

    public function test_sales_default_period_uses_latest_transaction_month_and_empty_source_returns_zero(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $variant = $this->createVariant('Produk Periode', 'Varian Periode', 1, 1200);
        $this->createTransaction('OLD', '2026-05-29', 'historis', [
            ['variant' => $variant, 'qty' => 1],
        ]);
        $this->createTransaction('NEW', '2026-06-03', 'kasir', [
            ['variant' => $variant, 'qty' => 2],
        ]);

        $this->getJson('/api/reports/sales?source=historis')
            ->assertOk()
            ->assertJsonPath('data.period.from', '2026-05-01')
            ->assertJsonPath('data.period.to', '2026-05-31');
        $this->getJson('/api/reports/sales')
            ->assertOk()
            ->assertJsonPath('data.period.from', '2026-06-01')
            ->assertJsonPath('data.period.to', '2026-06-30');

        $now = Carbon::now(config('app.timezone'));
        $this->getJson('/api/reports/sales?source=simulasi')
            ->assertOk()
            ->assertJsonPath('data.period.from', $now->copy()->startOfMonth()->toDateString())
            ->assertJsonPath('data.period.to', $now->copy()->endOfMonth()->toDateString())
            ->assertJsonPath('data.available.min_date', null)
            ->assertJsonPath('data.available.max_date', null)
            ->assertJsonPath('data.summary.total_omzet', 0)
            ->assertJsonPath('data.summary.jumlah_transaksi', 0)
            ->assertJsonPath('data.summary.total_pcs', 0)
            ->assertJsonPath('data.summary.rata_rata_omzet', 0)
            ->assertJsonPath('data.daily', [])
            ->assertJsonPath('data.top_products', []);
    }

    public function test_transaction_report_paginates_searches_sorts_and_formats_time(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $variant = $this->createVariant('Produk Cari', 'Varian Cari', 6, 2500);
        $older = $this->createTransaction('TRX-OLD', '2026-06-01', 'kasir', [
            ['variant' => $variant, 'qty' => 1],
        ], '2026-06-01 09:00:00');
        $historical = $this->createTransaction('TRX-HIST', '2026-06-02', 'historis', [
            ['variant' => $variant, 'qty' => 2],
        ]);
        $newer = $this->createTransaction('TRX-NEW', '2026-06-02', 'kasir', [
            ['variant' => $variant, 'qty' => 3],
        ], '2026-06-02 14:35:00');

        $this->getJson('/api/reports/transactions?from=2026-06-01&to=2026-06-02&per_page=2')
            ->assertOk()
            ->assertJsonPath('total', 3)
            ->assertJsonPath('current_page', 1)
            ->assertJsonPath('last_page', 2)
            ->assertJsonPath('per_page', 2)
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.0.jam', '14:35')
            ->assertJsonPath('data.0.total_amount', 7500)
            ->assertJsonPath('data.0.total_pcs', 18)
            ->assertJsonPath('data.0.items.0.variant_name', 'Varian Cari')
            ->assertJsonPath('data.1.id', $historical->id)
            ->assertJsonPath('data.1.jam', null);

        $this->getJson('/api/reports/transactions?from=2026-06-01&to=2026-06-02&page=2&per_page=2')
            ->assertOk()
            ->assertJsonPath('data.0.id', $older->id)
            ->assertJsonPath('data.0.jam', '09:00');
        $this->getJson('/api/reports/transactions?from=2026-06-01&to=2026-06-02&q=trx-new')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $newer->id);
        $this->getJson('/api/reports/transactions?from=2026-06-01&to=2026-06-02&q=VARIAN%20CARI')
            ->assertOk()
            ->assertJsonPath('total', 3);
        $this->getJson('/api/reports/transactions?from=2026-06-01&to=2026-06-02&q=PRODUK%20CARI')
            ->assertOk()
            ->assertJsonPath('total', 3);
        $this->getJson('/api/reports/transactions?from=2026-06-02&to=2026-06-02&source=kasir')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $newer->id);
    }

    private function createVariant(string $productName, string $variantName, ?int $packSize, int $price): ProductVariant
    {
        $product = Product::create(['name' => $productName]);

        return $product->variants()->create([
            'variant_name' => $variantName,
            'pack_size' => $packSize,
            'price' => $price,
        ]);
    }

    private function createTransaction(
        string $code,
        string $date,
        string $source,
        array $lines,
        ?string $transactedAt = null,
    ): Transaction {
        $amount = collect($lines)->sum(fn (array $line): int => $line['variant']->price * $line['qty']);
        $transaction = Transaction::create([
            'code' => $code,
            'transaction_date' => $date,
            'transacted_at' => $transactedAt,
            'total_amount' => $amount,
            'source' => $source,
            'basket_key' => $code,
        ]);

        foreach ($lines as $line) {
            $subtotal = $line['variant']->price * $line['qty'];
            TransactionItem::create([
                'transaction_id' => $transaction->id,
                'product_variant_id' => $line['variant']->id,
                'qty' => $line['qty'],
                'unit_price' => $line['variant']->price,
                'subtotal' => $subtotal,
            ]);
        }

        return $transaction;
    }
}
