<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'name' => $this->name,
            'quantity' => (float) $this->quantity,
            'quantity_label' => rtrim(rtrim(number_format((float) $this->quantity, 3, '.', ''), '0'), '.') . ' ' . ($this->unit ?: 'pcs'),
            'unit' => $this->unit,
            'category' => $this->category?->name ?? 'Uncategorized',
            'zone' => $this->zone,
            'location_type' => $this->location_type,
            'safety_buffer' => (float) $this->safety_buffer,
            'status' => $this->status,
            'qr_code' => $this->qr_code,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
