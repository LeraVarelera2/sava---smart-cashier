<?php

namespace App\Http\Requests;

use DateTimeImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ReportSalesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'source' => ['nullable', 'in:semua,historis,simulasi,kasir'],
            'from' => ['nullable', 'required_with:to', 'date_format:Y-m-d'],
            'to' => ['nullable', 'required_with:from', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }

    public function messages(): array
    {
        return [
            'source.in' => 'Sumber data tidak valid.',
            'from.required_with' => 'Tanggal mulai dan tanggal akhir harus diisi bersama.',
            'from.date_format' => 'Tanggal mulai harus menggunakan format YYYY-MM-DD.',
            'to.required_with' => 'Tanggal mulai dan tanggal akhir harus diisi bersama.',
            'to.date_format' => 'Tanggal akhir harus menggunakan format YYYY-MM-DD.',
            'to.after_or_equal' => 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $from = $this->input('from');
            $to = $this->input('to');

            if (is_string($from) && ! is_string($to)) {
                $validator->errors()->add('to', 'Tanggal mulai dan tanggal akhir harus diisi bersama.');
            } elseif (! is_string($from) && is_string($to)) {
                $validator->errors()->add('from', 'Tanggal mulai dan tanggal akhir harus diisi bersama.');
            }

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
