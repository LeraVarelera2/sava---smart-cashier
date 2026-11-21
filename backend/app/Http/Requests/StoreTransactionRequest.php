<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:999'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' => 'Item transaksi wajib diisi.',
            'items.array' => 'Daftar item transaksi tidak valid.',
            'items.min' => 'Minimal 1 item dalam transaksi.',
            'items.max' => 'Maksimal 50 item dalam transaksi.',
            'items.*.variant_id.required' => 'Varian produk wajib dipilih.',
            'items.*.variant_id.integer' => 'ID varian harus berupa angka bulat.',
            'items.*.variant_id.exists' => 'Varian produk tidak ditemukan.',
            'items.*.qty.required' => 'Jumlah wajib diisi.',
            'items.*.qty.integer' => 'Jumlah harus berupa angka bulat.',
            'items.*.qty.min' => 'Jumlah minimal 1.',
            'items.*.qty.max' => 'Jumlah maksimal 999.',
        ];
    }
}
