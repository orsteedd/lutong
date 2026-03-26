export interface DeliveryExpectedItem {
  sku: string
  name: string
  expectedQty: number
}

export interface DeliverySessionMock {
  id: string
  date: string
  supplier: string
  status: 'pending' | 'completed'
  expected: DeliveryExpectedItem[]
}

export const MOCK_DELIVERY_SESSIONS: DeliverySessionMock[] = [
  {
    id: 'DEL001',
    date: '2026-03-25',
    supplier: 'Metro Foods',
    status: 'pending',
    expected: [
      { sku: 'SKU-001', name: 'Jasmine Rice (10kg)', expectedQty: 8 },
      { sku: 'SKU-003', name: 'Fish Sauce (750ml)', expectedQty: 12 },
      { sku: 'SKU-010', name: 'Garlic (1kg)', expectedQty: 6 },
    ],
  },
  {
    id: 'DEL002',
    date: '2026-03-24',
    supplier: 'Asian Pantry Co.',
    status: 'completed',
    expected: [
      { sku: 'SKU-002', name: 'Glutinous Rice (5kg)', expectedQty: 6 },
      { sku: 'SKU-004', name: 'Soy Sauce (1L)', expectedQty: 10 },
    ],
  },
]

export const getDeliverySessionById = (sessionId: string) =>
  MOCK_DELIVERY_SESSIONS.find((session) => session.id === sessionId)
