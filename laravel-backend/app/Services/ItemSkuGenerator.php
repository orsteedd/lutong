<?php

namespace App\Services;

use App\Models\Item;

class ItemSkuGenerator
{
    public function generateNextSku(): string
    {
        $lastItem = Item::query()
            ->orderByDesc('id')
            ->first(['id', 'sku']);

        if (!$lastItem) {
            return 'SKU-001';
        }

        $lastSku = is_string($lastItem->sku) ? trim($lastItem->sku) : '';

        if ($lastSku !== '' && preg_match('/^SKU-(\d+)$/i', $lastSku, $matches) === 1) {
            $nextNumber = ((int) $matches[1]) + 1;
            return 'SKU-' . str_pad((string) $nextNumber, 3, '0', STR_PAD_LEFT);
        }

        $fallbackNumber = (int) $lastItem->id + 1;
        return 'SKU-' . str_pad((string) $fallbackNumber, 3, '0', STR_PAD_LEFT);
    }
}
