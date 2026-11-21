<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.variant_name' => ['required', 'string', 'max:255'],
            'variants.*.pack_size' => ['nullable', 'integer', 'min:1'],
            'variants.*.size_label' => ['nullable', 'string', 'max:50'],
            'variants.*.price' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama produk wajib diisi.',
            'name.string' => 'Nama produk harus berupa teks.',
            'name.max' => 'Nama produk maksimal 255 karakter.',
            'variants.required' => 'Minimal satu varian harus ditambahkan.',
            'variants.array' => 'Daftar varian tidak valid.',
            'variants.min' => 'Minimal satu varian harus ditambahkan.',
            'variants.*.variant_name.required' => 'Nama varian wajib diisi.',
            'variants.*.variant_name.string' => 'Nama varian harus berupa teks.',
            'variants.*.variant_name.max' => 'Nama varian maksimal 255 karakter.',
            'variants.*.pack_size.integer' => 'Isi kemasan harus berupa angka bulat.',
            'variants.*.pack_size.min' => 'Isi kemasan minimal 1.',
            'variants.*.size_label.string' => 'Label ukuran harus berupa teks.',
            'variants.*.size_label.max' => 'Label ukuran maksimal 50 karakter.',
            'variants.*.price.required' => 'Harga varian wajib diisi.',
            'variants.*.price.integer' => 'Harga varian harus berupa angka bulat.',
            'variants.*.price.min' => 'Harga varian minimal Rp1.',
        ];
    }
}
