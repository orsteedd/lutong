<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditItem extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'audit_id',
        'item_id',
        'system_qty',
        'actual_qty',
        'discrepancy_flag',
        'discrepancy_qty',
        'verified_at',
    ];

    protected $casts = [
        'system_qty' => 'decimal:3',
        'actual_qty' => 'decimal:3',
        'discrepancy_qty' => 'decimal:3',
        'verified_at' => 'datetime',
    ];

    public function audit(): BelongsTo
    {
        return $this->belongsTo(Audit::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
