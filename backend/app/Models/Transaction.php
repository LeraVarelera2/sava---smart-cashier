<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transaction extends Model
{
    protected $fillable = [
        'code',
        'transaction_date',
        'transacted_at',
        'total_amount',
        'source',
        'basket_key',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'transacted_at' => 'datetime',
            'total_amount' => 'integer',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }
}
