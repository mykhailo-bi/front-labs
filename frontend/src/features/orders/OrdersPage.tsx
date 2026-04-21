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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

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
    const selectedOrder = selectedOrderId ? visibleOrders.find((order) => order.id === selectedOrderId) ?? null : null
    const selectedTimeline = selectedOrder ? timelineByOrder[selectedOrder.id] : undefined
    const selectedInvoice = selectedOrder ? invoiceByOrder[selectedOrder.id] : undefined

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
                                                onClick={() => setSelectedOrderId(order.id)}
                                            >
                                                Manage
                                            </Button>
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

                <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => {
                    if (!open) {
                        setSelectedOrderId(null)
                    }
                }}>
                    <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-3xl'>
                        {selectedOrder ? (
                            <>
                                <DialogHeader>
                                    <DialogTitle>Order #{selectedOrder.id} actions</DialogTitle>
                                </DialogHeader>

                                <div className='space-y-3'>
                                    <div className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
                                        <Badge variant='secondary'>{selectedOrder.status}</Badge>
                                        <p className='text-sm text-muted-foreground'>
                                            User #{selectedOrder.user_id} - {new Date(selectedOrder.created_at).toLocaleString()}
                                        </p>
                                    </div>

                                    <div className='rounded-md border p-3'>
                                        <p className='text-sm font-medium'>Total</p>
                                        <p className='text-lg font-semibold'>{selectedOrder.currency} {selectedOrder.total}</p>
                                    </div>

                                    <div className='flex flex-wrap gap-2'>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={actionKey === `order:${selectedOrder.id}` || selectedOrder.status !== 'placed'}
                                            onClick={() => void applyAction(`order:${selectedOrder.id}`, async () => {
                                                await payOrder(selectedOrder.id, `pay-${selectedOrder.id}-${Date.now()}`)
                                            })}
                                        >
                                            Pay
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={actionKey === `order:${selectedOrder.id}` || selectedOrder.status !== 'placed'}
                                            onClick={() => void applyAction(`order:${selectedOrder.id}`, async () => {
                                                await markOrderPaid(selectedOrder.id, `admin-paid-${selectedOrder.id}-${Date.now()}`)
                                            })}
                                        >
                                            Mark Paid
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={actionKey === `order:${selectedOrder.id}` || !['paid', 'shipped', 'delivered'].includes(selectedOrder.status)}
                                            onClick={() => void applyAction(`order:${selectedOrder.id}`, async () => {
                                                await refundOrder(selectedOrder.id, 'Approved by admin dashboard')
                                            })}
                                        >
                                            Refund Req
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={actionKey === `order:${selectedOrder.id}` || !['paid', 'shipped', 'delivered'].includes(selectedOrder.status)}
                                            onClick={() => void applyAction(`order:${selectedOrder.id}`, async () => {
                                                await approveOrderRefund(selectedOrder.id)
                                            })}
                                        >
                                            Refund OK
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={actionKey === `order:${selectedOrder.id}`}
                                            onClick={() => void applyAction(`order:${selectedOrder.id}`, async () => {
                                                const payload = await fetchOrderTimeline(selectedOrder.id)
                                                setTimelineByOrder((prev) => ({ ...prev, [selectedOrder.id]: payload }))
                                            })}
                                        >
                                            Timeline
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={actionKey === `order:${selectedOrder.id}`}
                                            onClick={() => void applyAction(`order:${selectedOrder.id}`, async () => {
                                                const payload = await fetchOrderInvoice(selectedOrder.id)
                                                setInvoiceByOrder((prev) => ({ ...prev, [selectedOrder.id]: payload.invoice }))
                                            })}
                                        >
                                            Invoice
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={actionKey === `order:${selectedOrder.id}` || !['placed', 'paid'].includes(selectedOrder.status)}
                                            onClick={() => void applyAction(`order:${selectedOrder.id}`, async () => {
                                                await shipOrder(selectedOrder.id)
                                            })}
                                        >
                                            Ship
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={actionKey === `order:${selectedOrder.id}` || selectedOrder.status !== 'shipped'}
                                            onClick={() => void applyAction(`order:${selectedOrder.id}`, async () => {
                                                await deliverOrder(selectedOrder.id)
                                            })}
                                        >
                                            Deliver
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={actionKey === `order:${selectedOrder.id}` || !['placed', 'paid'].includes(selectedOrder.status)}
                                            onClick={() => void applyAction(`order:${selectedOrder.id}`, async () => {
                                                await cancelOrder(selectedOrder.id)
                                            })}
                                        >
                                            Cancel
                                        </Button>
                                    </div>

                                    {selectedInvoice ? <pre className='whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs'>{selectedInvoice}</pre> : null}
                                    {selectedTimeline?.length ? (
                                        <div className='space-y-1 text-xs text-muted-foreground'>
                                            {selectedTimeline.map((event) => (
                                                <p key={event.id}>
                                                    {new Date(event.created_at).toLocaleString()} - {event.event_type}
                                                    {event.note ? ` (${event.note})` : ''}
                                                </p>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        ) : null}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}
