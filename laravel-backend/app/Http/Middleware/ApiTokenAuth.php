<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiTokenAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization');
        if (!is_string($header) || !str_starts_with($header, 'Bearer ')) {
            return new JsonResponse([
                'message' => 'Unauthorized.',
            ], 401);
        }

        $token = trim(substr($header, 7));
        if ($token === '') {
            return new JsonResponse([
                'message' => 'Unauthorized.',
            ], 401);
        }

        $tokenHash = hash('sha256', $token);
        $user = User::query()->where('api_token', $tokenHash)->first();

        if (!$user) {
            return new JsonResponse([
                'message' => 'Unauthorized.',
            ], 401);
        }

        $request->setUserResolver(static fn() => $user);

        return $next($request);
    }
}
