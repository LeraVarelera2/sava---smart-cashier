<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TransactionIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['nullable', 'date_format:Y-m-d'],
            'source' => ['nullable', 'in:semua,historis,simulasi,kasir'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'date.date_format' => 'Tanggal harus menggunakan format YYYY-MM-DD.',
            'source.in' => 'Sumber transaksi tidak valid.',
            'per_page.integer' => 'Jumlah data per halaman harus berupa angka bulat.',
            'per_page.min' => 'Jumlah data per halaman minimal 1.',
            'per_page.max' => 'Jumlah data per halaman maksimal 100.',
            'page.integer' => 'Nomor halaman harus berupa angka bulat.',
            'page.min' => 'Nomor halaman minimal 1.',
        ];
    }
}
