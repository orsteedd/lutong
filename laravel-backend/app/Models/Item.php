<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Item extends Model
{
    use HasFactory;

    const UPDATED_AT = null;

    protected $fillable = [
        'sku',
        'name',
        'category_id',
        'unit',
        'zone',
        'location_type',
        'quantity',
        'qr_code',
        'safety_buffer',
        'created_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'safety_buffer' => 'decimal:3',
        'created_at' => 'datetime',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function inventoryLogs(): HasMany
    {
        return $this->hasMany(InventoryLog::class);
    }

    public function deliveryItems(): HasMany
    {
        return $this->hasMany(DeliveryItem::class);
    }

    public function auditItems(): HasMany
    {
        return $this->hasMany(AuditItem::class);
    }
}
