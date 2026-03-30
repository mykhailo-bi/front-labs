import { authRequest, paginated } from '@/lib/api/core'
import type { Order, OrderEvent, RefundRequest } from '@/lib/api/types'
import type { PaginatedResponse } from '@/lib/api/core'

export async function fetchOrders(page = 1, pageSize?: number): Promise<PaginatedResponse<Order>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/orders/?page=${page}${pageSizeQuery}`)
    return paginated<Order>(data)
}

export async function shipOrder(id: number): Promise<Order> {
    return authRequest<Order>(`/orders/${id}/ship/`, { method: 'POST' })
}

export async function deliverOrder(id: number): Promise<Order> {
    return authRequest<Order>(`/orders/${id}/deliver/`, { method: 'POST' })
}

export async function cancelOrder(id: number): Promise<Order> {
    return authRequest<Order>(`/orders/${id}/cancel/`, { method: 'POST' })
}

export async function payOrder(id: number, reference_id?: string): Promise<{ order: Order }> {
    return authRequest<{ order: Order }>(`/orders/${id}/pay/`, {
        method: 'POST',
        body: JSON.stringify({ order_id: id, reference_id: reference_id ?? '' }),
    })
}

export async function refundOrder(id: number, reason: string): Promise<RefundRequest> {
    return authRequest<RefundRequest>(`/orders/${id}/refund/`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    })
}

export async function approveOrderRefund(id: number): Promise<Order> {
    return authRequest<Order>(`/orders/${id}/refund-approve/`, { method: 'POST' })
}

export async function fetchOrderTimeline(id: number): Promise<OrderEvent[]> {
    return authRequest<OrderEvent[]>(`/orders/${id}/timeline/`)
}

export async function fetchOrderInvoice(id: number): Promise<{ invoice: string }> {
    return authRequest<{ invoice: string }>(`/orders/${id}/invoice/`)
}

export async function markOrderPaid(order_id: number, reference_id?: string): Promise<{ order: Order }> {
    return authRequest<{ order: Order }>('/payments/mark-paid/', {
        method: 'POST',
        body: JSON.stringify({ order_id, reference_id: reference_id ?? '' }),
    })
}
