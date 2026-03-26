<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Audit extends Model
{
    use HasFactory;

    const UPDATED_AT = null;

    protected $fillable = [
        'status',
        'is_rejected',
        'rejected_at',
        'created_at',
        'submitted_at',
        'approved_at',
    ];

    protected $casts = [
        'is_rejected' => 'boolean',
        'rejected_at' => 'datetime',
        'created_at' => 'datetime',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    public function auditItems(): HasMany
    {
        return $this->hasMany(AuditItem::class);
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
