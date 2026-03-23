import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { deleteUser, listUsers } from '../services/userService'
import Loader from '../components/Loader'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../components/ui/card'
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table'

const roleVariant = (role) => {
    if (role === 'admin') {
        return 'default'
    }
    if (role === 'staff') {
        return 'secondary'
    }
    return 'outline'
}

const statusVariant = (status) => {
    if (status === 'active') {
        return 'success'
    }
    if (status === 'pending' || status === 'invited') {
        return 'warning'
    }
    return 'outline'
}

const useUsersData = () => {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const normalizeUsers = (payload) => {
        if (Array.isArray(payload)) {
            return payload
        }
        if (Array.isArray(payload?.results)) {
            return payload.results
        }
        return []
    }

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const { data } = await listUsers()
            setUsers(normalizeUsers(data))
        } catch (err) {
            setUsers([])
            setError(err?.response?.data?.detail || 'Failed to load users')
        } finally {
            setLoading(false)
        }
    }, [])

    const remove = useCallback(async (id) => {
        if (!window.confirm('Delete this user?')) {
            return
        }
        try {
            await deleteUser(id)
            await load()
        } catch (err) {
            setError(err?.response?.data?.detail || 'Failed to delete user')
        }
    }, [load])

    useEffect(() => {
        load()
    }, [load])

    return { users, loading, error, load, remove }
}

const UsersHeader = ({ onCreate }) => (
    <Card className="border-border/80 bg-card/95">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>Manage platform users and account status.</CardDescription>
            </div>
            <Button type="button" onClick={onCreate}>
                <Plus className="h-4 w-4" />
                New user
            </Button>
        </CardHeader>
    </Card>
)

const UsersTableCard = ({ users, onDelete }) => (
    <Card className="border-border/80 bg-card/95">
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.isArray(users) && users.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell className="font-mono text-xs">#{user.id}</TableCell>
                            <TableCell className="font-medium">{user.username}</TableCell>
                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                            <TableCell>
                                <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex justify-end gap-2">
                                    <Button asChild variant="outline" size="sm">
                                        <Link to={`/admin/users/${user.id}`}>View</Link>
                                    </Button>
                                    <Button asChild variant="secondary" size="sm">
                                        <Link to={`/admin/users/${user.id}/edit`}>Edit</Link>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => onDelete(user.id)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                {users.length === 0 && <TableCaption>No users available.</TableCaption>}
            </Table>
        </CardContent>
    </Card>
)

const UsersPage = () => {
    const navigate = useNavigate()
    const { users, loading, error, remove } = useUsersData()

    return (
        <div className="space-y-4">
            <UsersHeader onCreate={() => navigate('/admin/users/new')} />

            {loading && (
                <Card className="border-border/80 bg-card/95">
                    <CardContent className="p-5">
                        <Loader />
                    </CardContent>
                </Card>
            )}

            {error && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                    {error}
                </div>
            )}

            {!loading && !error && <UsersTableCard users={users} onDelete={remove} />}
        </div>
    )
}

export default UsersPage
