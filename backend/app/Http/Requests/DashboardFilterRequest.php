<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DashboardFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'source' => ['nullable', 'in:semua,historis,simulasi,kasir'],
            'range' => ['nullable', 'in:7,30,90,semua'],
        ];
    }

    public function messages(): array
    {
        return [
            'source.in' => 'Sumber data tidak valid.',
            'range.in' => 'Rentang data harus 7, 30, 90, atau semua.',
        ];
    }
}
