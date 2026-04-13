import { useCallback, useEffect, useState } from 'react'
import { ApiError, customerCancelOrder, customerPayOrder, customerRefundOrder, fetchMyOrderInvoice, fetchMyOrders, fetchMyOrderTimeline, type Order, type OrderEvent } from '@/lib/api'
import { notify } from '@/lib/notify'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

export function CustomerOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [timelineByOrder, setTimelineByOrder] = useState<Record<number, OrderEvent[]>>({})
    const [invoiceByOrder, setInvoiceByOrder] = useState<Record<number, string>>({})
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setError(null)
        try {
            const payload = await fetchMyOrders(1, 100)
            setOrders(payload.results)
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const applyAction = async (key: string, callback: () => Promise<void>) => {
        setBusyKey(key)
        try {
            await callback()
            await refresh()
        } catch (err) {
            notify.error(parseErrorMessage(err))
        } finally {
            setBusyKey(null)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>My Orders</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
                {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                {orders.map((order) => {
                    const canPay = order.status === 'placed'
                    const canCancel = order.status === 'placed'
                    const canRefund = ['paid', 'shipped', 'delivered'].includes(order.status)
                    const isBusy = Boolean(busyKey)
                    const timeline = timelineByOrder[order.id]
                    const invoice = invoiceByOrder[order.id]
                    return (
                        <div key={order.id} className='rounded-md border p-3'>
                            <div className='flex flex-wrap items-center justify-between gap-3'>
                                <div>
                                    <p className='font-medium'>Order #{order.id}</p>
                                    <p className='text-sm text-muted-foreground'>
                                        {order.currency} {order.total} - {new Date(order.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <Badge variant='secondary'>{order.status}</Badge>
                            </div>
                            <div className='mt-3 flex flex-wrap gap-2'>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    disabled={isBusy || !canPay}
                                    onClick={() => void applyAction(`order:pay:${order.id}`, async () => {
                                        await customerPayOrder(order.id, `cust-pay-${order.id}-${Date.now()}`)
                                        notify.success('Payment applied')
                                    })}
                                >
                                    Pay
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    disabled={isBusy || !canCancel}
                                    onClick={() => void applyAction(`order:cancel:${order.id}`, async () => {
                                        await customerCancelOrder(order.id)
                                        notify.success('Order cancelled')
                                    })}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    disabled={isBusy || !canRefund}
                                    onClick={() => void applyAction(`order:refund:${order.id}`, async () => {
                                        await customerRefundOrder(order.id, 'Requested by customer')
                                        notify.success('Refund requested')
                                    })}
                                >
                                    Request refund
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    disabled={isBusy}
                                    onClick={() => void applyAction(`order:timeline:${order.id}`, async () => {
                                        const rows = await fetchMyOrderTimeline(order.id)
                                        setTimelineByOrder((prev) => ({ ...prev, [order.id]: rows }))
                                    })}
                                >
                                    Timeline
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    disabled={isBusy}
                                    onClick={() => void applyAction(`order:invoice:${order.id}`, async () => {
                                        const payload = await fetchMyOrderInvoice(order.id)
                                        setInvoiceByOrder((prev) => ({ ...prev, [order.id]: payload.invoice }))
                                    })}
                                >
                                    Invoice
                                </Button>
                            </div>
                            {invoice ? <pre className='mt-3 whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs'>{invoice}</pre> : null}
                            {timeline?.length ? (
                                <div className='mt-3 space-y-1 text-xs text-muted-foreground'>
                                    {timeline.map((event) => (
                                        <p key={event.id}>{new Date(event.created_at).toLocaleString()} - {event.event_type}</p>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    )
                })}
                {orders.length === 0 ? <p className='text-sm text-muted-foreground'>No orders yet.</p> : null}
            </CardContent>
        </Card>
    )
}
