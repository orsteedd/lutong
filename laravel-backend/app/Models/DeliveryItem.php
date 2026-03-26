<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryItem extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'delivery_id',
        'item_id',
        'expected_qty',
        'actual_qty',
        'discrepancy_flag',
        'discrepancy_qty',
        'verification_status',
        'verified_at',
    ];

    protected $casts = [
        'expected_qty' => 'decimal:3',
        'actual_qty' => 'decimal:3',
        'discrepancy_qty' => 'decimal:3',
        'verified_at' => 'datetime',
    ];

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
