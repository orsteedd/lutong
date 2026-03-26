<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'item_id',
        'type',
        'quantity',
        'source',
        'timestamp',
        'status',
        'sync_record_id',
        'sync_payload_hash',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'timestamp' => 'datetime',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }
}
