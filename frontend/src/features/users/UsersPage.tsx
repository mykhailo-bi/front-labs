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
import { ApiError, fetchUsers, updateUser, type PaginatedResponse, type User } from '@/lib/api'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

export function UsersPage() {
    const [users, setUsers] = useState<PaginatedResponse<User> | null>(null)
    const [page, setPage] = useState(1)
    const [isLoading, setIsLoading] = useState(true)
    const [actionKey, setActionKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const nextUsers = await fetchUsers(page)
            setUsers(nextUsers)
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
                <CardTitle>User Management</CardTitle>
                <CardDescription>Toggle user status and role</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
                {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(users?.results ?? []).map((user) => {
                            const key = `user:${user.id}`
                            const nextStatus = user.status === 'active' ? 'suspended' : 'active'
                            const nextRole = user.role === 'admin' ? 'customer' : 'admin'
                            const isBusy = actionKey === key

                            return (
                                <TableRow key={user.id}>
                                    <TableCell>{user.id}</TableCell>
                                    <TableCell>{user.username}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                                            {user.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{user.role}</TableCell>
                                    <TableCell className='text-right'>
                                        <div className='flex justify-end gap-2'>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        await updateUser(user.id, { status: nextStatus })
                                                    })
                                                }
                                            >
                                                {nextStatus}
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={isBusy}
                                                onClick={() =>
                                                    void applyAction(key, async () => {
                                                        await updateUser(user.id, { role: nextRole })
                                                    })
                                                }
                                            >
                                                Make {nextRole}
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
                    hasPrevious={Boolean(users?.previous)}
                    hasNext={Boolean(users?.next)}
                    onPageChange={setPage}
                />
                {isLoading ? <p className='text-sm text-muted-foreground'>Loading users...</p> : null}
            </CardContent>
        </Card>
    )
}
