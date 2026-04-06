<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleAccess
{
    public function handle(Request $request, Closure $next, string ...$allowedRoles): Response
    {
        $user = $request->user();
        $role = is_object($user) ? (string) ($user->role ?? '') : '';

        if ($role === '' || !in_array($role, $allowedRoles, true)) {
            return new JsonResponse([
                'message' => 'Forbidden. You do not have permission for this action.',
            ], 403);
        }

        return $next($request);
    }
}
