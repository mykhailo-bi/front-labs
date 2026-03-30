import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pager } from '@/components/common/Pager'
import { Badge } from '@/components/ui/badge'
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
import { CreateUserModal } from '@/features/users/components/CreateUserModal'
import { EditUserModal } from '@/features/users/components/EditUserModal'
import { InviteUserModal } from '@/features/users/components/InviteUserModal'
import { UsersCsvModal } from '@/features/users/components/UsersCsvModal'
import {
    ApiError,
    createUserInvite,
    createUser,
    deleteUser,
    exportUsersCsv,
    fetchUserOrders,
    fetchUsers,
    importUsersCsv,
    updateUserProfile,
    type Order,
    type PaginatedResponse,
    type User,
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

type UsersPageProps = {
    currentUserId: number
}

export function UsersPage({ currentUserId }: UsersPageProps) {
    const [users, setUsers] = useState<PaginatedResponse<User> | null>(null)
    const [page, setPage] = useState(1)
    const [isLoading, setIsLoading] = useState(true)
    const [actionKey, setActionKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [ordersByUser, setOrdersByUser] = useState<Record<number, Order[]>>({})

    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const nextUsers = await fetchUsers(page, PAGE_SIZE)
            setUsers(nextUsers)
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

    const applyAction = async (
        key: string,
        callback: () => Promise<void>,
        successMessage = 'User updated successfully',
    ) => {
        setActionKey(key)
        setError(null)
        try {
            await callback()
            await refresh()
            notify.success(successMessage)
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setActionKey(null)
        }
    }

    const updateExistingUser = async (
        id: number,
        input: {
            username: string
            email: string
            password?: string
            firstname?: string
            lastname?: string
            role: 'admin' | 'customer'
            status: 'active' | 'suspended'
        },
    ) => {
        await applyAction(`user:edit:${id}`, async () => {
            await updateUserProfile(id, {
                username: input.username,
                email: input.email,
                password: input.password,
                firstname: input.firstname,
                lastname: input.lastname,
                role: input.role,
                status: input.status,
            })
        })
    }

    const deleteExistingUser = async (id: number) => {
        await applyAction(
            `user:delete:${id}`,
            async () => {
                await deleteUser(id)
            },
            'User deleted successfully',
        )
    }

    const createNewUser = async (input: {
        username: string
        email: string
        password: string
        firstname?: string
        lastname?: string
        role: 'admin' | 'customer'
        status: 'active' | 'suspended'
    }) => {
        setActionKey('user:create')
        setError(null)
        try {
            await createUser({
                username: input.username,
                email: input.email,
                password: input.password,
                firstname: input.firstname,
                lastname: input.lastname,
                role: input.role,
                status: input.status,
            })

            await refresh()
            notify.success('User created successfully')
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
            throw err
        } finally {
            setActionKey(null)
        }
    }

    const downloadUsersCsv = async () => {
        await applyAction('users:export', async () => {
            const csv = await exportUsersCsv()
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', 'users.csv')
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        }, 'Users exported')
    }

    const sendInvite = async (email: string) => {
        await applyAction('users:invite', async () => {
            await createUserInvite({ email, role: 'customer' })
        }, 'Invite created')
    }

    const importUsers = async (file: File) => {
        await applyAction('users:import', async () => {
            await importUsersCsv(file)
        }, 'Users imported')
    }

    const loadUserOrders = async (userId: number) => {
        await applyAction(`user:orders:${userId}`, async () => {
            const payload = await fetchUserOrders(userId, 1, 10)
            setOrdersByUser((prev) => ({ ...prev, [userId]: payload.results }))
        }, 'User orders loaded')
    }

    const totalPages = users ? Math.max(1, Math.ceil(users.count / PAGE_SIZE)) : 1
    const isServerPaginated =
        Boolean(users?.next || users?.previous) ||
        (users ? users.results.length < users.count : false)
    const visibleUsers = users
        ? isServerPaginated
            ? users.results
            : users.results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        : []
    const hasPreviousPage = isServerPaginated ? Boolean(users?.previous) : page > 1
    const hasNextPage = isServerPaginated ? Boolean(users?.next) : page < totalPages

    return (
        <section className='space-y-4'>
            {error ? <p className='text-sm text-destructive'>{error}</p> : null}

            <Card>
                <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div>
                        <CardTitle>Users</CardTitle>
                    </div>
                    <div className='flex items-center gap-2'>
                        <UsersCsvModal isSubmitting={Boolean(actionKey)} onExport={downloadUsersCsv} onImport={importUsers} />
                        <InviteUserModal
                            isSubmitting={actionKey === 'users:invite'}
                            onValidationError={(message) => {
                                setError(message)
                                notify.error(message)
                            }}
                            onInvite={sendInvite}
                        />
                        <CreateUserModal
                            isSubmitting={actionKey === 'user:create'}
                            onValidationError={(message) => {
                                setError(message)
                                notify.error(message)
                            }}
                            onCreate={createNewUser}
                        />
                    </div>
                </CardHeader>
                <CardContent className='space-y-4'>
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
                        {visibleUsers.map((user) => {
                            const isBusy =
                                actionKey === `user:edit:${user.id}` ||
                                actionKey === `user:delete:${user.id}` ||
                                actionKey === 'user:create'

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
                                            <EditUserModal
                                                user={user}
                                                currentUserId={currentUserId}
                                                isSubmitting={isBusy}
                                                onValidationError={(message) => {
                                                    setError(message)
                                                    notify.error(message)
                                                }}
                                                onUpdate={updateExistingUser}
                                                onDelete={deleteExistingUser}
                                            />
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={Boolean(actionKey)}
                                                onClick={() => void loadUserOrders(user.id)}
                                            >
                                                Orders
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {visibleUsers.map((user) => {
                            const userOrders = ordersByUser[user.id]
                            if (!userOrders?.length) {
                                return null
                            }
                            return (
                                <TableRow key={`orders-${user.id}`}>
                                    <TableCell colSpan={6}>
                                        <div className='rounded-md border bg-muted/20 p-2 text-xs'>
                                            {userOrders.map((order) => (
                                                <p key={order.id}>
                                                    #{order.id} {order.status} {order.currency} {order.total}
                                                </p>
                                            ))}
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
                    {isLoading ? <p className='text-sm text-muted-foreground'>Loading users...</p> : null}
                </CardContent>
            </Card>
        </section>
    )
}
