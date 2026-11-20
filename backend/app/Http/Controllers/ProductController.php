<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(): JsonResponse
    {
        $products = Product::with(['variants' => function ($q) {
            $q->where('is_active', true);
        }])->orderBy('name')->get();

        return response()->json(['data' => $products]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'variants' => 'required|array|min:1',
            'variants.*.variant_name' => 'required|string|max:255',
            'variants.*.pack_size' => 'nullable|integer|min:1',
            'variants.*.size_label' => 'nullable|string|max:50',
            'variants.*.price' => 'required|integer|min:1',
        ], [
            'name.required' => 'Nama produk wajib diisi.',
            'variants.required' => 'Minimal satu varian harus ditambahkan.',
            'variants.min' => 'Minimal satu varian harus ditambahkan.',
            'variants.*.variant_name.required' => 'Nama varian wajib diisi.',
            'variants.*.price.required' => 'Harga varian wajib diisi.',
            'variants.*.price.min' => 'Harga varian minimal Rp1.',
        ]);

        $product = Product::create(['name' => $request->name]);

        foreach ($request->variants as $v) {
            $product->variants()->create([
                'variant_name' => $v['variant_name'],
                'pack_size' => $v['pack_size'] ?? null,
                'size_label' => $v['size_label'] ?? null,
                'price' => $v['price'],
            ]);
        }

        $product->load('variants');

        return response()->json(['data' => $product], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:255',
        ], [
            'name.required' => 'Nama produk wajib diisi.',
        ]);

        $product->update(['name' => $request->name]);
        $product->load(['variants' => fn($q) => $q->where('is_active', true)]);

        return response()->json(['data' => $product]);
    }

    public function destroy(int $id): JsonResponse
    {
        $product = Product::with('variants.transactionItems')->findOrFail($id);

        $hasTransactions = false;
        foreach ($product->variants as $variant) {
            if ($variant->transactionItems()->exists()) {
                $hasTransactions = true;
                break;
            }
        }

        if ($hasTransactions) {
            // Deactivate all variants instead of deleting
            $product->variants()->update(['is_active' => false]);
            return response()->json(['message' => 'Produk dinonaktifkan karena memiliki riwayat transaksi.']);
        }

        $product->delete();

        return response()->json(['message' => 'Produk berhasil dihapus.']);
    }

    public function storeVariant(Request $request, int $productId): JsonResponse
    {
        $product = Product::findOrFail($productId);

        $request->validate([
            'variant_name' => 'required|string|max:255',
            'pack_size' => 'nullable|integer|min:1',
            'size_label' => 'nullable|string|max:50',
            'price' => 'required|integer|min:1',
        ], [
            'variant_name.required' => 'Nama varian wajib diisi.',
            'price.required' => 'Harga varian wajib diisi.',
            'price.min' => 'Harga varian minimal Rp1.',
        ]);

        $variant = $product->variants()->create([
            'variant_name' => $request->variant_name,
            'pack_size' => $request->pack_size,
            'size_label' => $request->size_label,
            'price' => $request->price,
        ]);

        return response()->json(['data' => $variant], 201);
    }

    public function updateVariant(Request $request, int $id): JsonResponse
    {
        $variant = ProductVariant::findOrFail($id);

        $request->validate([
            'variant_name' => 'required|string|max:255',
            'pack_size' => 'nullable|integer|min:1',
            'size_label' => 'nullable|string|max:50',
            'price' => 'required|integer|min:1',
            'is_active' => 'nullable|boolean',
        ], [
            'variant_name.required' => 'Nama varian wajib diisi.',
            'price.required' => 'Harga varian wajib diisi.',
            'price.min' => 'Harga varian minimal Rp1.',
        ]);

        $variant->update($request->only(['variant_name', 'pack_size', 'size_label', 'price', 'is_active']));

        return response()->json(['data' => $variant]);
    }

    public function destroyVariant(int $id): JsonResponse
    {
        $variant = ProductVariant::findOrFail($id);

        if ($variant->transactionItems()->exists()) {
            $variant->update(['is_active' => false]);
            return response()->json(['message' => 'Varian dinonaktifkan karena memiliki riwayat transaksi.']);
        }

        $variant->delete();

        return response()->json(['message' => 'Varian berhasil dihapus.']);
    }
}
