<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ActivityLogger
{
    public function log(?int $userId, string $actionType, ?int $itemId = null, array $metadata = []): void
    {
        $this->logMany([[
            'user_id' => $userId,
            'action_type' => $actionType,
            'item_id' => $itemId,
            'metadata' => $metadata,
        ]]);
    }

    public function logMany(array $entries): void
    {
        if (empty($entries)) {
            return;
        }

        $now = now();
        $rows = [];

        foreach ($entries as $entry) {
            $rows[] = [
                'user_id' => $entry['user_id'] ?? null,
                'action_type' => (string) ($entry['action_type'] ?? 'unknown'),
                'item_id' => $entry['item_id'] ?? null,
                'metadata' => isset($entry['metadata']) ? json_encode($entry['metadata']) : null,
                'timestamp' => $entry['timestamp'] ?? $now,
            ];
        }

        foreach (array_chunk($rows, 1000) as $chunk) {
            DB::table('activity_logs')->insert($chunk);
        }
    }
}
