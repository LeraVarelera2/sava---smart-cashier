<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_login_and_invalid_credentials_are_rejected(): void
    {
        User::factory()->create([
            'email' => 'admin@sava.test',
            'password' => Hash::make('Admin12345'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'admin@sava.test',
            'password' => 'Admin12345',
        ])->assertOk()->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

        $this->postJson('/api/login', [
            'email' => 'admin@sava.test',
            'password' => 'salah',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email'])
            ->assertJsonPath('errors.email.0', 'Email atau password salah.');
    }

    public function test_transaction_uses_database_price_and_rejects_invalid_quantity(): void
    {
        $user = User::factory()->create();
        $variant = $this->createVariant(price: 12500, packSize: 6);
        Sanctum::actingAs($user);

        $this->postJson('/api/transactions', [
            'items' => [[
                'variant_id' => $variant->id,
                'qty' => 2,
                'unit_price' => 1,
                'subtotal' => 2,
            ]],
            'total_amount' => 2,
        ])->assertCreated()
            ->assertJsonPath('data.total_amount', 25000)
            ->assertJsonPath('data.items.0.unit_price', 12500)
            ->assertJsonPath('data.items.0.subtotal', 25000);

        $this->postJson('/api/transactions', [
            'items' => [['variant_id' => $variant->id, 'qty' => 0]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['items.0.qty']);

        $this->assertDatabaseCount('transactions', 1);
    }

    public function test_dashboard_summary_returns_correct_totals_for_small_dataset(): void
    {
        $user = User::factory()->create();
        $variant = $this->createVariant(price: 10000, packSize: 6);
        $this->createTransaction('TEST-1', 20000, $variant, 2, '2026-11-01');
        $this->createTransaction('TEST-2', 30000, $variant, 3, '2026-11-02');
        Sanctum::actingAs($user);

        $this->getJson('/api/dashboard/summary?source=kasir&range=semua')
            ->assertOk()
            ->assertJsonPath('data.total_omzet', 50000)
            ->assertJsonPath('data.jumlah_transaksi', 2)
            ->assertJsonPath('data.total_pcs', 30)
            ->assertJsonPath('data.rata_rata_omzet', 25000);

        $this->getJson('/api/dashboard/trend?source=kasir&range=7')->assertOk();
        $this->getJson('/api/dashboard/top-products?source=kasir&range=7')->assertOk();
        $this->getJson('/api/dashboard/busy-days?source=kasir&range=7')->assertOk();
        $this->getJson('/api/dashboard/busy-hours?source=kasir&range=7')
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('message', 'Belum ada data jam. Jam tercatat dari transaksi kasir.');
        $this->getJson('/api/dashboard/summary?source=lainnya')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['source']);
    }

    public function test_deleting_used_variant_deactivates_instead_of_removing_it(): void
    {
        $user = User::factory()->create();
        $variant = $this->createVariant(price: 8000, packSize: 1);
        $this->createTransaction('TEST-USED', 8000, $variant, 1, '2026-11-03');
        Sanctum::actingAs($user);

        $this->deleteJson('/api/variants/'.$variant->id)
            ->assertOk()
            ->assertJsonPath('message', 'Varian dinonaktifkan karena memiliki riwayat transaksi.');

        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'is_active' => false,
        ]);
        $this->postJson('/api/transactions', [
            'items' => [['variant_id' => $variant->id, 'qty' => 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['items']);
    }

    public function test_catalog_and_transaction_list_use_validated_api_filters(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $created = $this->postJson('/api/products', [
            'name' => 'Kopi',
            'variants' => [[
                'variant_name' => 'Kopi Susu',
                'pack_size' => 1,
                'price' => 15000,
            ]],
        ])->assertCreated();
        $variantId = $created->json('data.variants.0.id');

        $this->getJson('/api/products')->assertOk()->assertJsonPath('data.0.name', 'Kopi');
        $this->putJson('/api/products/'.$created->json('data.id'), ['name' => 'Kopi Pilihan'])
            ->assertOk()->assertJsonPath('data.name', 'Kopi Pilihan');

        $this->postJson('/api/transactions', [
            'items' => [['variant_id' => $variantId, 'qty' => 1]],
        ])->assertCreated();

        $this->getJson('/api/transactions?source=kasir&per_page=5')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('per_page', 5);
        $this->getJson('/api/transactions?date=invalid')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);

        $this->deleteJson('/api/products/'.$created->json('data.id'))
            ->assertOk()
            ->assertJsonPath('message', 'Produk dinonaktifkan karena memiliki riwayat transaksi.');
        $this->assertDatabaseHas('products', ['id' => $created->json('data.id')]);
        $this->assertDatabaseHas('product_variants', ['id' => $variantId, 'is_active' => false]);
    }

    public function test_business_profile_can_be_saved_and_includes_business_busy_data(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->putJson('/api/business-profile', [
            'business_name' => 'Toko Contoh',
            'business_type' => 'Makanan',
            'address' => 'Jalan Merdeka',
            'rt' => '01',
            'rw' => '02',
            'kelurahan' => 'Sukamaju',
            'phone' => '08123456789',
        ])->assertOk()
            ->assertJsonPath('data.business_name', 'Toko Contoh');

        $this->getJson('/api/business-profile')
            ->assertOk()
            ->assertJsonPath('data.business_name', 'Toko Contoh')
            ->assertJsonStructure(['data' => ['kesibukan' => ['hari_tersibuk', 'jam_tersibuk']]]);
    }

    private function createVariant(int $price, int $packSize): ProductVariant
    {
        $product = Product::create(['name' => 'Produk Tes']);

        return $product->variants()->create([
            'variant_name' => 'Varian Tes',
            'pack_size' => $packSize,
            'price' => $price,
        ]);
    }

    private function createTransaction(
        string $code,
        int $amount,
        ProductVariant $variant,
        int $qty,
        string $date,
    ): Transaction {
        $transaction = Transaction::create([
            'code' => $code,
            'transaction_date' => $date,
            'total_amount' => $amount,
            'source' => 'kasir',
            'basket_key' => $code,
        ]);
        TransactionItem::create([
            'transaction_id' => $transaction->id,
            'product_variant_id' => $variant->id,
            'qty' => $qty,
            'unit_price' => $variant->price,
            'subtotal' => $amount,
        ]);

        return $transaction;
    }
}
