<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Adjustment extends Model
{
    use HasFactory;

    protected $fillable = [
        'summary_date',
        'scans',
        'wastage',
        'transfers',
    ];

    protected $casts = [
        'summary_date' => 'date',
        'scans' => 'integer',
        'wastage' => 'decimal:3',
        'transfers' => 'decimal:3',
    ];
}
