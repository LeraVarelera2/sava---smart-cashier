<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\StoreProductVariantRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Http\Requests\UpdateProductVariantRequest;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\TransactionItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function index(): JsonResponse
    {
        $products = Product::with(['variants' => function ($q) {
            $q->where('is_active', true);
        }])->orderBy('name')->get();

        return response()->json(['data' => $products]);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $data = $request->validated();
        $product = DB::transaction(function () use ($data) {
            $product = Product::create(['name' => $data['name']]);

            foreach ($data['variants'] as $variant) {
                $product->variants()->create([
                    'variant_name' => $variant['variant_name'],
                    'pack_size' => $variant['pack_size'] ?? null,
                    'size_label' => $variant['size_label'] ?? null,
                    'price' => $variant['price'],
                ]);
            }

            return $product;
        });

        $product->load('variants');

        return response()->json(['data' => $product], 201);
    }

    public function update(UpdateProductRequest $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $product->update($request->validated());
        $product->load(['variants' => fn ($q) => $q->where('is_active', true)]);

        return response()->json(['data' => $product]);
    }

    public function destroy(int $id): JsonResponse
    {
        $hasTransactions = DB::transaction(function () use ($id) {
            $product = Product::whereKey($id)->lockForUpdate()->firstOrFail();
            $variantIds = ProductVariant::where('product_id', $product->id)
                ->lockForUpdate()
                ->pluck('id');
            $hasTransactions = TransactionItem::whereIn('product_variant_id', $variantIds)->exists();

            if ($hasTransactions) {
                ProductVariant::whereIn('id', $variantIds)->update(['is_active' => false]);

                return true;
            }

            $product->delete();

            return false;
        });

        if ($hasTransactions) {
            return response()->json(['message' => 'Produk dinonaktifkan karena memiliki riwayat transaksi.']);
        }

        return response()->json(['message' => 'Produk berhasil dihapus.']);
    }

    public function storeVariant(StoreProductVariantRequest $request, int $productId): JsonResponse
    {
        $product = Product::findOrFail($productId);
        $variant = $product->variants()->create($request->validated());

        return response()->json(['data' => $variant], 201);
    }

    public function updateVariant(UpdateProductVariantRequest $request, int $id): JsonResponse
    {
        $variant = ProductVariant::findOrFail($id);
        $variant->update($request->validated());

        return response()->json(['data' => $variant]);
    }

    public function destroyVariant(int $id): JsonResponse
    {
        $wasUsed = DB::transaction(function () use ($id) {
            $variant = ProductVariant::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($variant->transactionItems()->exists()) {
                $variant->update(['is_active' => false]);

                return true;
            }
            $variant->delete();

            return false;
        });

        if ($wasUsed) {
            return response()->json(['message' => 'Varian dinonaktifkan karena memiliki riwayat transaksi.']);
        }

        return response()->json(['message' => 'Varian berhasil dihapus.']);
    }
}
