import { useCallback, useEffect, useState } from 'react'
import { Pager } from '@/components/common/Pager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
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
    ApiError,
    cancelOrder,
    deliverOrder,
    fetchOrders,
    shipOrder,
    type Order,
    type PaginatedResponse,
} from '@/lib/api'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

export function OrdersPage() {
    const [orders, setOrders] = useState<PaginatedResponse<Order> | null>(null)
    const [page, setPage] = useState(1)
    const [isLoading, setIsLoading] = useState(true)
    const [actionKey, setActionKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const nextOrders = await fetchOrders(page)
            setOrders(nextOrders)
        } catch (err) {
            setError(parseErrorMessage(err))
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
        } catch (err) {
            setError(parseErrorMessage(err))
        } finally {
            setActionKey(null)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Order Operations</CardTitle>
                <CardDescription>Ship, deliver, and cancel orders</CardDescription>
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
                        {(orders?.results ?? []).map((order) => {
                            const key = `order:${order.id}`
                            const canShip = ['placed', 'paid'].includes(order.status)
                            const canDeliver = order.status === 'shipped'
                            const canCancel = ['placed', 'paid'].includes(order.status)
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
                    </TableBody>
                </Table>
                <Pager
                    page={page}
                    hasPrevious={Boolean(orders?.previous)}
                    hasNext={Boolean(orders?.next)}
                    onPageChange={setPage}
                />
                {isLoading ? <p className='text-sm text-muted-foreground'>Loading orders...</p> : null}
            </CardContent>
        </Card>
    )
}
