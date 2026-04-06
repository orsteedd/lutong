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
            'username' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $username = mb_strtolower(trim($validated['username']));

        $user = User::query()
            ->whereRaw('LOWER(username) = ?', [$username])
            ->first();

        if (!$user || !Hash::check($validated['password'], $user->password ?? '')) {
            return response()->json([
                'message' => 'Invalid username or password.',
            ], 422);
        }

        $plainToken = Str::random(64);
        $tokenHash = hash('sha256', $plainToken);

        $user->forceFill([
            'api_token' => $tokenHash,
            'last_login_at' => now(),
        ])->save();

        return response()->json([
            'message' => 'Login successful.',
            'data' => [
                'token' => $plainToken,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'role' => $user->role,
                ],
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthorized.',
            ], 401);
        }

        return response()->json([
            'message' => 'Authenticated user fetched.',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'role' => $user->role,
                ],
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user) {
            $user->forceFill(['api_token' => null])->save();
        }

        return response()->json([
            'message' => 'Logout successful.',
        ]);
    }
}
