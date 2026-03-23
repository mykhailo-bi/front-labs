import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Activity,
    Boxes,
    CircleDollarSign,
    Download,
    PackageSearch,
    RefreshCcw,
    ShieldAlert,
    ShoppingCart,
    UserPlus,
    Users,
} from 'lucide-react'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { fetchAggregateReport, exportUsersCsv } from '../services/adminService'
import { listUsers } from '../services/userService'
import { Button } from '../components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table'

const STAT_ITEMS = [
    { label: 'Users', key: 'users', icon: Users, note: 'Accounts currently onboarded' },
    { label: 'Products', key: 'products', icon: Boxes, note: 'Catalog entries in circulation' },
    { label: 'Total orders', key: 'orders', icon: ShoppingCart, note: 'Orders processed overall' },
    { label: 'Paid orders', key: 'paid_orders', icon: Activity, note: 'Payments successfully captured' },
    { label: 'Refund requests', key: 'refunds', icon: ShieldAlert, note: 'Support queue currently open' },
    { label: 'Inventory at risk', key: 'inventory_risk', icon: PackageSearch, note: 'SKUs close to stockout' },
    { label: 'Orders this month', key: 'mtd_orders', icon: Activity, note: 'Current month order velocity' },
]

const normalizeUsers = (payload) => {
    if (Array.isArray(payload)) {
        return payload
    }
    if (Array.isArray(payload?.results)) {
        return payload.results
    }
    return []
}

const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
}

const formatMetricValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return '--'
    }
    if (typeof value === 'number') {
        return value.toLocaleString()
    }
    return String(value)
}

const formatRevenue = (value, currency) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: currency || 'USD',
                maximumFractionDigits: 0,
            }).format(parsed)
        } catch {
            return `${parsed.toLocaleString()} ${currency || ''}`.trim()
        }
    }
    return formatMetricValue(value)
}

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

const useDashboardData = () => {
    const [stats, setStats] = useState(null)
    const [recentUsers, setRecentUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [{ data: reportData }, { data: usersData }] = await Promise.all([
                fetchAggregateReport(),
                listUsers({ ordering: '-created_at' }),
            ])
            setStats(reportData)
            setRecentUsers(normalizeUsers(usersData).slice(0, 5))
        } catch (err) {
            setStats(null)
            setRecentUsers([])
            setError(err?.response?.data?.detail || 'Failed to load dashboard metrics')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    return { stats, recentUsers, loading, error, setError, reload: load }
}

const DashboardHeader = ({ fullName, exporting, onRefresh, onExport, onCreateUser }) => (
    <Card className="relative overflow-hidden border-border/80 bg-card/95">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/15 via-transparent to-transparent" />
        <CardHeader className="relative gap-4 pb-4 md:flex-row md:items-start md:justify-between">
            <div>
                <CardTitle className="text-lg sm:text-xl">Operations dashboard</CardTitle>
                <CardDescription className="mt-1 text-sm">
                    Welcome back, {fullName}. This is a live snapshot of admin health and user activity.
                </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={onRefresh}>
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                </Button>
                <Button type="button" variant="secondary" disabled={exporting} onClick={onExport}>
                    <Download className="h-4 w-4" />
                    {exporting ? 'Exporting...' : 'Export users CSV'}
                </Button>
                <Button type="button" onClick={onCreateUser}>
                    <UserPlus className="h-4 w-4" />
                    New user
                </Button>
            </div>
        </CardHeader>
    </Card>
)

const MetricCard = ({ label, note, value, Icon }) => (
    <Card className="border-border/80 bg-card/90">
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
            <span className="rounded-md border border-border/80 bg-muted/60 p-1.5 text-muted-foreground">
                <Icon className="h-4 w-4" />
            </span>
        </CardHeader>
        <CardContent className="space-y-1">
            <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{note}</p>
        </CardContent>
    </Card>
)

const StatsGrid = ({ stats }) => (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_ITEMS.map((item) => (
            <MetricCard
                key={item.key}
                label={item.label}
                note={item.note}
                value={formatMetricValue(stats[item.key])}
                Icon={item.icon}
            />
        ))}
        <MetricCard
            label={`Revenue (${stats.currency || 'USD'})`}
            note="Gross revenue from paid orders"
            value={formatRevenue(stats.revenue, stats.currency)}
            Icon={CircleDollarSign}
        />
    </div>
)

const RecentUsersTable = ({ users, onOpenManagement }) => (
    <Card className="border-border/80 bg-card/95">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
                <CardTitle>Recently created users</CardTitle>
                <CardDescription>Latest signups and access posture.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onOpenManagement}>
                Open user management
            </Button>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((recentUser) => (
                        <TableRow key={recentUser.id}>
                            <TableCell className="font-mono text-xs">#{recentUser.id}</TableCell>
                            <TableCell className="font-medium">{recentUser.username}</TableCell>
                            <TableCell className="text-muted-foreground">{recentUser.email}</TableCell>
                            <TableCell>
                                <Badge variant={roleVariant(recentUser.role)}>{recentUser.role}</Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={statusVariant(recentUser.status)}>{recentUser.status}</Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                {users.length === 0 && <TableCaption>No users found yet.</TableCaption>}
            </Table>
        </CardContent>
    </Card>
)

const SessionMeta = ({ user, stats }) => (
    <Card className="border-border/80 bg-card/95">
        <CardHeader>
            <CardTitle>Session & platform pulse</CardTitle>
            <CardDescription>Current operator context and monthly momentum.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Signed in as</span>
                    <span className="font-medium">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Role</span>
                    <Badge variant={roleVariant(user?.role)}>{user?.role || 'user'}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={statusVariant(user?.status || 'active')}>{user?.status || 'active'}</Badge>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                    <span>Month-to-date orders</span>
                    <span className="font-mono text-foreground">{formatMetricValue(stats.mtd_orders)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min(Number(stats.mtd_orders || 0) * 5, 100)}%` }}
                    />
                </div>
                <p className="text-xs text-muted-foreground">This bar scales dynamically from current monthly order volume.</p>
            </div>
        </CardContent>
    </Card>
)

const DashboardPage = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { stats, recentUsers, loading, error, setError, reload } = useDashboardData()
    const [exporting, setExporting] = useState(false)

    const fullName = useMemo(() => {
        if (user?.firstname || user?.lastname) {
            return [user.firstname, user.lastname].filter(Boolean).join(' ')
        }
        return user?.username
    }, [user])

    const handleExportUsers = useCallback(async () => {
        setExporting(true)
        setError('')
        try {
            const { data } = await exportUsersCsv()
            downloadBlob(new Blob([data], { type: 'text/csv' }), 'users.csv')
        } catch (err) {
            setError(err?.response?.data?.detail || 'Failed to export users')
        } finally {
            setExporting(false)
        }
    }, [setError])

    const openCreateUser = useCallback(() => navigate('/admin/users/new'), [navigate])
    const openUserManagement = useCallback(() => navigate('/admin/users'), [navigate])

    return (
        <div className="space-y-4">
            <DashboardHeader
                fullName={fullName}
                exporting={exporting}
                onRefresh={reload}
                onExport={handleExportUsers}
                onCreateUser={openCreateUser}
            />

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

            {!loading && !error && stats && (
                <div className="space-y-4">
                    <StatsGrid stats={stats} />
                    <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
                        <RecentUsersTable users={recentUsers} onOpenManagement={openUserManagement} />
                        <SessionMeta user={user} stats={stats} />
                    </div>
                </div>
            )}

            {!loading && !error && !stats && (
                <Card className="border-border/80 bg-card/95">
                    <CardContent className="p-5 text-sm text-muted-foreground">No dashboard data available.</CardContent>
                </Card>
            )}
        </div>
    )
}

export default DashboardPage
