<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductVariantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'variant_name' => ['required', 'string', 'max:255'],
            'pack_size' => ['nullable', 'integer', 'min:1'],
            'size_label' => ['nullable', 'string', 'max:50'],
            'price' => ['required', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'variant_name.required' => 'Nama varian wajib diisi.',
            'variant_name.string' => 'Nama varian harus berupa teks.',
            'variant_name.max' => 'Nama varian maksimal 255 karakter.',
            'pack_size.integer' => 'Isi kemasan harus berupa angka bulat.',
            'pack_size.min' => 'Isi kemasan minimal 1.',
            'size_label.string' => 'Label ukuran harus berupa teks.',
            'size_label.max' => 'Label ukuran maksimal 50 karakter.',
            'price.required' => 'Harga varian wajib diisi.',
            'price.integer' => 'Harga varian harus berupa angka bulat.',
            'price.min' => 'Harga varian minimal Rp1.',
            'is_active.boolean' => 'Status aktif tidak valid.',
        ];
    }
}
