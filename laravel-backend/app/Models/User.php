<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory;
    use Notifiable;

    public $timestamps = false;

    protected $fillable = [
        'name',
        'username',
        'password',
        'role',
    ];

    protected $hidden = [
        'password',
    ];

    public function scopeAdmin($query)
    {
        return $query->where('role', 'admin');
    }

    public function scopeStaff($query)
    {
        return $query->where('role', 'staff');
    }
}
