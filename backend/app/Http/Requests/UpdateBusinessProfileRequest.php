<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBusinessProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'business_name' => ['required', 'string', 'max:255'],
            'business_type' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'rt' => ['nullable', 'string', 'max:10'],
            'rw' => ['nullable', 'string', 'max:10'],
            'kelurahan' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'business_name.required' => 'Nama usaha wajib diisi.',
            'business_name.string' => 'Nama usaha harus berupa teks.',
            'business_name.max' => 'Nama usaha maksimal 255 karakter.',
            'business_type.string' => 'Jenis usaha harus berupa teks.',
            'business_type.max' => 'Jenis usaha maksimal 255 karakter.',
            'address.string' => 'Alamat harus berupa teks.',
            'address.max' => 'Alamat maksimal 500 karakter.',
            'rt.string' => 'RT harus berupa teks.',
            'rt.max' => 'RT maksimal 10 karakter.',
            'rw.string' => 'RW harus berupa teks.',
            'rw.max' => 'RW maksimal 10 karakter.',
            'kelurahan.string' => 'Kelurahan harus berupa teks.',
            'kelurahan.max' => 'Kelurahan maksimal 255 karakter.',
            'phone.string' => 'Nomor telepon harus berupa teks.',
            'phone.max' => 'Nomor telepon maksimal 20 karakter.',
        ];
    }
}
