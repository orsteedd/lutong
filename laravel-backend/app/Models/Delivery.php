<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Delivery extends Model
{
    use HasFactory;

    const UPDATED_AT = null;

    protected $fillable = [
        'supplier_name',
        'status',
        'is_rejected',
        'rejected_at',
        'created_at',
    ];

    protected $casts = [
        'is_rejected' => 'boolean',
        'rejected_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function deliveryItems(): HasMany
    {
        return $this->hasMany(DeliveryItem::class);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending')->where('is_rejected', false);
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }
}
