<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->where('username', strtolower($validated['username']))
            ->first();

        if (!$user || !is_string($user->password) || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid username or password.',
            ], 401);
        }

        return response()->json([
            'message' => 'Login successful.',
            'data' => [
                'token' => Str::random(40),
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'role' => $user->role,
                ],
            ],
        ]);
    }
}
