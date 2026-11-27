<?php

namespace App\Http\Requests;

use DateTimeImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ReportTransactionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'source' => ['nullable', 'in:semua,historis,simulasi,kasir'],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'source.in' => 'Sumber data tidak valid.',
            'from.required' => 'Tanggal mulai wajib diisi.',
            'from.date_format' => 'Tanggal mulai harus menggunakan format YYYY-MM-DD.',
            'to.required' => 'Tanggal akhir wajib diisi.',
            'to.date_format' => 'Tanggal akhir harus menggunakan format YYYY-MM-DD.',
            'to.after_or_equal' => 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.',
            'q.string' => 'Pencarian harus berupa teks.',
            'q.max' => 'Pencarian maksimal 100 karakter.',
            'per_page.integer' => 'Jumlah data per halaman harus berupa angka bulat.',
            'per_page.min' => 'Jumlah data per halaman minimal 1.',
            'per_page.max' => 'Jumlah data per halaman maksimal 1000.',
            'page.integer' => 'Nomor halaman harus berupa angka bulat.',
            'page.min' => 'Nomor halaman minimal 1.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $from = $this->input('from');
            $to = $this->input('to');

            if (
                $validator->errors()->isNotEmpty()
                || ! is_string($from)
                || ! is_string($to)
                || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)
                || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)
            ) {
                return;
            }

            $fromDate = DateTimeImmutable::createFromFormat('!Y-m-d', $from);
            $toDate = DateTimeImmutable::createFromFormat('!Y-m-d', $to);

            if ($fromDate && $toDate && (int) $fromDate->diff($toDate)->format('%a') >= 366) {
                $validator->errors()->add('to', 'Rentang tanggal maksimal 366 hari.');
            }
        });
    }
}
