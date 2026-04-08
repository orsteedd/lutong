import type { PendingScan } from '@/store/useOfflineQueueStore'
import { getApiBaseUrl } from './apiBaseUrl'
import { notifyError } from './toastNotify'

export interface SyncResponse {
  success: boolean
  syncedIds: string[]
  message?: string
  statusCode?: number
}

const toItemId = (sku: string): number | null => {
  const direct = Number.parseInt(sku, 10)
  if (Number.isFinite(direct) && direct > 0) return direct

  const trailingDigits = sku.match(/(\d+)$/)
  if (!trailingDigits) return null

  const parsed = Number.parseInt(trailingDigits[1], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export const sendPendingScansToApi = async (records: PendingScan[]): Promise<SyncResponse> => {
  if (records.length === 0) {
    return { success: true, syncedIds: [], message: 'No records to sync' }
  }

  const endpoint = `${getApiBaseUrl()}/api/v1/sync`
  const nowIso = new Date().toISOString()
  const payloadRecords = records
    .map((record) => {
      const parsedItemId = toItemId(record.sku)
      if (!parsedItemId) {
        return null
      }

      return {
        item_id: parsedItemId,
        type: record.type,
        quantity: record.quantity,
        timestamp: new Date(record.timestamp).toISOString(),
        source: 'pwa-sync',
        sync_record_id: record.id,
        synced_at: nowIso,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (payloadRecords.length === 0) {
    throw new Error('Sync skipped: queued records do not contain mappable item IDs.')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: payloadRecords }),
  })

  const data = (await response.json()) as {
    message?: string
    data?: {
      summary?: {
        success?: number
      }
      results?: Array<{
        success?: boolean
        sync_record_id?: string
      }>
    }
  }

  if (!response.ok) {
    notifyError('Backend error', data.message || 'Laravel API sync failed')
    throw new Error(data.message || 'Laravel API sync failed')
  }

  const succeededIds =
    data.data?.results
      ?.filter((result) => result.success)
      .map((result) => result.sync_record_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0) || []

  return {
    success: true,
    syncedIds: succeededIds.length > 0 ? succeededIds : records.map((record) => record.id),
    message: data.message || `Synced ${data.data?.summary?.success ?? payloadRecords.length} records`,
    statusCode: response.status,
  }
}
