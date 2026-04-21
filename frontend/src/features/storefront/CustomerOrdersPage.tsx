import { useCallback, useEffect, useState } from 'react'
import { ApiError, customerCancelOrder, customerPayOrder, customerRefundOrder, fetchMyOrderInvoice, fetchMyOrders, fetchMyOrderTimeline, fetchStoreProducts, type Order, type OrderEvent, type Product } from '@/lib/api'
import { OrderDetailsProductCard } from '@/components/common/OrderDetailsProductCard'
import { notify } from '@/lib/notify'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
    const [productsById, setProductsById] = useState<Record<number, Product>>({})
    const [timelineByOrder, setTimelineByOrder] = useState<Record<number, OrderEvent[]>>({})
    const [invoiceByOrder, setInvoiceByOrder] = useState<Record<number, string>>({})
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

    const refresh = useCallback(async () => {
        setError(null)
        try {
            const [ordersPayload, productsPayload] = await Promise.all([
                fetchMyOrders(1, 100),
                fetchStoreProducts(1, 500),
            ])
            setOrders(ordersPayload.results)
            const productMap: Record<number, Product> = {}
            productsPayload.results.forEach((product) => {
                productMap[product.id] = product
            })
            setProductsById(productMap)
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

    const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) ?? null : null
    const selectedTimeline = selectedOrder ? timelineByOrder[selectedOrder.id] : undefined
    const selectedInvoice = selectedOrder ? invoiceByOrder[selectedOrder.id] : undefined

    return (
        <Card>
            <CardHeader>
                <CardTitle>My Orders</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
                {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                {orders.map((order) => (
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
                        <div className='mt-3'>
                            <Button size='sm' variant='outline' onClick={() => setSelectedOrderId(order.id)}>
                                Details
                            </Button>
                        </div>
                    </div>
                ))}
                {orders.length === 0 ? <p className='text-sm text-muted-foreground'>No orders yet.</p> : null}
            </CardContent>

            <Dialog
                open={Boolean(selectedOrder)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedOrderId(null)
                    }
                }}
            >
                <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
                    {selectedOrder ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Order #{selectedOrder.id} details</DialogTitle>
                            </DialogHeader>

                            <div className='space-y-3'>
                                <div className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
                                    <Badge variant='secondary'>{selectedOrder.status}</Badge>
                                    <p className='text-sm text-muted-foreground'>
                                        {new Date(selectedOrder.created_at).toLocaleString()}
                                    </p>
                                </div>

                                {selectedOrder.items?.length ? (
                                    <div className='grid gap-2'>
                                        {selectedOrder.items.map((item) => {
                                            const product = productsById[item.product_id]
                                            const productName = product?.name ?? `Product #${item.product_id}`
                                            return (
                                                <OrderDetailsProductCard
                                                    key={`${selectedOrder.id}-${item.product_id}`}
                                                    productName={productName}
                                                    product={product}
                                                    count={item.count}
                                                    currency={selectedOrder.currency}
                                                />
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className='text-sm text-muted-foreground'>No products attached to this order.</p>
                                )}

                                <div className='rounded-md border p-3'>
                                    <p className='text-sm font-medium'>Total price</p>
                                    <p className='text-lg font-semibold'>{selectedOrder.currency} {selectedOrder.total}</p>
                                </div>

                                <div className='flex flex-wrap gap-2'>
                                    <Button
                                        size='sm'
                                        variant='outline'
                                        disabled={Boolean(busyKey) || selectedOrder.status !== 'placed'}
                                        onClick={() => void applyAction(`order:pay:${selectedOrder.id}`, async () => {
                                            await customerPayOrder(selectedOrder.id, `cust-pay-${selectedOrder.id}-${Date.now()}`)
                                            notify.success('Payment applied')
                                        })}
                                    >
                                        Pay
                                    </Button>
                                    <Button
                                        size='sm'
                                        variant='outline'
                                        disabled={Boolean(busyKey) || selectedOrder.status !== 'placed'}
                                        onClick={() => void applyAction(`order:cancel:${selectedOrder.id}`, async () => {
                                            await customerCancelOrder(selectedOrder.id)
                                            notify.success('Order cancelled')
                                        })}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size='sm'
                                        variant='outline'
                                        disabled={Boolean(busyKey) || !['paid', 'shipped', 'delivered'].includes(selectedOrder.status)}
                                        onClick={() => void applyAction(`order:refund:${selectedOrder.id}`, async () => {
                                            await customerRefundOrder(selectedOrder.id, 'Requested by customer')
                                            notify.success('Refund requested')
                                        })}
                                    >
                                        Request refund
                                    </Button>
                                    <Button
                                        size='sm'
                                        variant='outline'
                                        disabled={Boolean(busyKey)}
                                        onClick={() => void applyAction(`order:timeline:${selectedOrder.id}`, async () => {
                                            const rows = await fetchMyOrderTimeline(selectedOrder.id)
                                            setTimelineByOrder((prev) => ({ ...prev, [selectedOrder.id]: rows }))
                                        })}
                                    >
                                        Timeline
                                    </Button>
                                    <Button
                                        size='sm'
                                        variant='outline'
                                        disabled={Boolean(busyKey)}
                                        onClick={() => void applyAction(`order:invoice:${selectedOrder.id}`, async () => {
                                            const payload = await fetchMyOrderInvoice(selectedOrder.id)
                                            setInvoiceByOrder((prev) => ({ ...prev, [selectedOrder.id]: payload.invoice }))
                                        })}
                                    >
                                        Invoice
                                    </Button>
                                </div>

                                {selectedInvoice ? <pre className='whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs'>{selectedInvoice}</pre> : null}
                                {selectedTimeline?.length ? (
                                    <div className='space-y-1 text-xs text-muted-foreground'>
                                        {selectedTimeline.map((event) => (
                                            <p key={event.id}>{new Date(event.created_at).toLocaleString()} - {event.event_type}</p>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </Card>
    )
}
