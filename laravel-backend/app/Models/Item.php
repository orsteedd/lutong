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
        'name',
        'category_id',
        'qr_code',
        'safety_buffer',
        'created_at',
    ];

    protected $casts = [
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
