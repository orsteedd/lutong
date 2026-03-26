<?php

return [
    'auto_approve_types' => [],

    'cache' => [
        'store' => env('INVENTORY_CACHE_STORE', env('CACHE_STORE', null)),
        'ttl_seconds' => (int) env('INVENTORY_CACHE_TTL', 120),
    ],
];
