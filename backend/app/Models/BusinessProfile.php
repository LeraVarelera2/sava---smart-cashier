<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BusinessProfile extends Model
{
    protected $fillable = [
        'business_name',
        'business_type',
        'address',
        'rt',
        'rw',
        'kelurahan',
        'phone',
    ];
}
