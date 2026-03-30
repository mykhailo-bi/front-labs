import { useCallback, useEffect, useState } from 'react'
import { Pager } from '@/components/common/Pager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    approveOrderRefund,
    ApiError,
    cancelOrder,
    deliverOrder,
    fetchOrderInvoice,
    fetchOrderTimeline,
    fetchOrders,
    markOrderPaid,
    payOrder,
    refundOrder,
    shipOrder,
    type Order,
    type OrderEvent,
    type PaginatedResponse,
} from '@/lib/api'
import { notify } from '@/lib/notify'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

const PAGE_SIZE = 10

export function OrdersPage() {
    const [orders, setOrders] = useState<PaginatedResponse<Order> | null>(null)
    const [page, setPage] = useState(1)
    const [isLoading, setIsLoading] = useState(true)
    const [actionKey, setActionKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [timelineByOrder, setTimelineByOrder] = useState<Record<number, OrderEvent[]>>({})
    const [invoiceByOrder, setInvoiceByOrder] = useState<Record<number, string>>({})

    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const nextOrders = await fetchOrders(page, PAGE_SIZE)
            setOrders(nextOrders)
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setIsLoading(false)
        }
    }, [page])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const applyAction = async (key: string, callback: () => Promise<void>) => {
        setActionKey(key)
        setError(null)
        try {
            await callback()
            await refresh()
            notify.success('Order updated successfully')
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setActionKey(null)
        }
    }

    const totalPages = orders ? Math.max(1, Math.ceil(orders.count / PAGE_SIZE)) : 1
    const isServerPaginated =
        Boolean(orders?.next || orders?.previous) ||
        (orders ? orders.results.length < orders.count : false)
    const visibleOrders = orders
        ? isServerPaginated
            ? orders.results
            : orders.results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        : []
    const hasPreviousPage = isServerPaginated ? Boolean(orders?.previous) : page > 1
    const hasNextPage = isServerPaginated ? Boolean(orders?.next) : page < totalPages

    return (
        <Card>
            <CardHeader>
                <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>User ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibleOrders.map((order) => {
                            const key = `order:${order.id}`
                            const canShip = ['placed', 'paid'].includes(order.status)
                            const canDeliver = order.status === 'shipped'
                            const canCancel = ['placed', 'paid'].includes(order.status)
                            const canPay = order.status === 'placed'
                            const canRefund = ['paid', 'shipped', 'delivered'].includes(order.status)
                            const isBusy = actionKey === key

                            return (
                                <TableRow key={order.id}>
                                    <TableCell>{order.id}</TableCell>
                                    <TableCell>{order.user_id}</TableCell>
                                    <TableCell>
                                        <Badge variant='secondary'>{order.status}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {order.currency} {order.total}
                                    </TableCell>
                                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell className='text-right'>
                                        <div className='flex justify-end gap-2'>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy || !canPay}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        await payOrder(order.id, `pay-${order.id}-${Date.now()}`)
                                                    })
                                                }
                                            >
                                                Pay
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy || !canPay}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        await markOrderPaid(order.id, `admin-paid-${order.id}-${Date.now()}`)
                                                    })
                                                }
                                            >
                                                Mark Paid
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy || !canRefund}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        await refundOrder(order.id, 'Approved by admin dashboard')
                                                    })
                                                }
                                            >
                                                Refund Req
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy || !canRefund}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        await approveOrderRefund(order.id)
                                                    })
                                                }
                                            >
                                                Refund OK
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        const payload = await fetchOrderTimeline(order.id)
                                                        setTimelineByOrder((prev) => ({ ...prev, [order.id]: payload }))
                                                    })
                                                }
                                            >
                                                Timeline
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        const payload = await fetchOrderInvoice(order.id)
                                                        setInvoiceByOrder((prev) => ({ ...prev, [order.id]: payload.invoice }))
                                                    })
                                                }
                                            >
                                                Invoice
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy || !canShip}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        await shipOrder(order.id)
                                                    })
                                                }
                                            >
                                                Ship
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy || !canDeliver}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        await deliverOrder(order.id)
                                                    })
                                                }
                                            >
                                                Deliver
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy || !canCancel}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        await cancelOrder(order.id)
                                                    })
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {visibleOrders.map((order) => {
                            const timeline = timelineByOrder[order.id]
                            const invoice = invoiceByOrder[order.id]
                            if (!timeline?.length && !invoice) {
                                return null
                            }
                            return (
                                <TableRow key={`details-${order.id}`}>
                                    <TableCell colSpan={6}>
                                        <div className='space-y-3 rounded-md border bg-muted/20 p-3'>
                                            {invoice ? <pre className='whitespace-pre-wrap text-xs'>{invoice}</pre> : null}
                                            {timeline?.length ? (
                                                <div className='space-y-1 text-xs'>
                                                    {timeline.map((event) => (
                                                        <p key={event.id}>
                                                            {new Date(event.created_at).toLocaleString()} - {event.event_type}
                                                            {event.note ? ` (${event.note})` : ''}
                                                        </p>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                <Pager
                    page={page}
                    totalPages={totalPages}
                    hasPrevious={hasPreviousPage}
                    hasNext={hasNextPage}
                    disabled={isLoading}
                    onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
                />
                {isLoading ? <p className='text-sm text-muted-foreground'>Loading orders...</p> : null}
            </CardContent>
        </Card>
    )
}
