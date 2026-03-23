import { useCallback, useEffect, useState } from 'react'
import { Database, RefreshCcw } from 'lucide-react'
import Loader from '../components/Loader'
import { listUsers } from '../services/userService'
import {
    listAddresses,
    listCategories,
    listImages,
    listOrders,
    listProducts,
    listReviews,
} from '../services/adminService'
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

const PAGE_SIZE = 8

const normalizeListPayload = (payload) => {
    if (Array.isArray(payload)) {
        return payload
    }
    if (Array.isArray(payload?.results)) {
        return payload.results
    }
    return []
}

const safeDate = (value) => {
    if (!value) {
        return '-'
    }
    return new Date(value).toLocaleString()
}

const statusVariant = (status) => {
    if (status === 'active' || status === 'paid' || status === 'delivered') {
        return 'success'
    }
    if (status === 'pending') {
        return 'warning'
    }
    return 'outline'
}

const roleVariant = (role) => {
    if (role === 'admin') {
        return 'default'
    }
    return 'secondary'
}

const CELL_TRIM = 'max-w-[260px] truncate text-muted-foreground'

const sectionColumns = {
    users: [
        { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
        { header: 'Username', render: (row) => row.username, className: 'font-medium' },
        { header: 'Email', render: (row) => row.email, className: 'text-muted-foreground' },
        { header: 'Role', render: (row) => <Badge variant={roleVariant(row.role)}>{row.role}</Badge> },
        { header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
    ],
    products: [
        { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
        { header: 'SKU', render: (row) => row.sku || '-', className: 'text-muted-foreground' },
        { header: 'Name', render: (row) => row.name, className: 'font-medium' },
        { header: 'Price', render: (row) => row.price },
        { header: 'Stock', render: (row) => row.stock_qty },
        { header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
    ],
    orders: [
        { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
        { header: 'User', render: (row) => row.user?.username || row.user || '-' },
        { header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
        { header: 'Total', render: (row) => row.total },
        { header: 'Created', render: (row) => safeDate(row.created_at), className: 'text-muted-foreground' },
    ],
    reviews: [
        { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
        { header: 'User', render: (row) => row.user?.username || row.user || '-' },
        { header: 'Product', render: (row) => row.product?.name || row.product || '-' },
        { header: 'Rating', render: (row) => row.rating },
        { header: 'Comment', render: (row) => row.text || '-', className: CELL_TRIM },
    ],
    categories: [
        { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
        { header: 'Name', render: (row) => row.name, className: 'font-medium' },
        { header: 'Slug', render: (row) => row.slug, className: 'text-muted-foreground' },
        { header: 'Parent', render: (row) => row.parent?.name || row.parent || '-' },
        { header: 'Updated', render: (row) => safeDate(row.updated_at), className: 'text-muted-foreground' },
    ],
    images: [
        { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
        { header: 'URL', render: (row) => row.url, className: CELL_TRIM },
        { header: 'Created', render: (row) => safeDate(row.created_at), className: 'text-muted-foreground' },
    ],
    addresses: [
        { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
        { header: 'User', render: (row) => row.user?.username || row.user || '-' },
        { header: 'Label', render: (row) => row.label || '-' },
        { header: 'City', render: (row) => row.city },
        { header: 'Country', render: (row) => row.country },
        { header: 'Default', render: (row) => (row.is_default ? 'Yes' : 'No') },
    ],
}

const TableSection = ({ title, rows, columns }) => (
    <Card className="border-border/80 bg-card/95">
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
            <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>Live API snapshot ({rows.length} rows)</CardDescription>
            </div>
            <Badge variant="outline">{rows.length} rows</Badge>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        {columns.map((column) => (
                            <TableHead key={column.header}>{column.header}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.id}>
                            {columns.map((column) => (
                                <TableCell key={`${column.header}-${row.id}`} className={column.className}>
                                    {column.render(row)}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
                {rows.length === 0 && <TableCaption>No records available.</TableCaption>}
            </Table>
        </CardContent>
    </Card>
)

const useAdminDataTables = () => {
    const [state, setState] = useState({
        loading: true,
        error: '',
        users: [],
        products: [],
        orders: [],
        reviews: [],
        categories: [],
        images: [],
        addresses: [],
    })

    const load = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: '' }))
        try {
            const [usersRes, productsRes, ordersRes, reviewsRes, categoriesRes, imagesRes, addressesRes] = await Promise.all([
                listUsers({ page_size: PAGE_SIZE }),
                listProducts({ page_size: PAGE_SIZE, ordering: '-created_at' }),
                listOrders({ page_size: PAGE_SIZE, ordering: '-created_at' }),
                listReviews({ page_size: PAGE_SIZE, ordering: '-id' }),
                listCategories({ page_size: PAGE_SIZE, ordering: '-updated_at' }),
                listImages({ page_size: PAGE_SIZE, ordering: '-created_at' }),
                listAddresses({ page_size: PAGE_SIZE, ordering: '-updated_at' }),
            ])

            setState({
                loading: false,
                error: '',
                users: normalizeListPayload(usersRes.data),
                products: normalizeListPayload(productsRes.data),
                orders: normalizeListPayload(ordersRes.data),
                reviews: normalizeListPayload(reviewsRes.data),
                categories: normalizeListPayload(categoriesRes.data),
                images: normalizeListPayload(imagesRes.data),
                addresses: normalizeListPayload(addressesRes.data),
            })
        } catch (error) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: error?.response?.data?.detail || 'Failed to load admin data tables',
            }))
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    return { ...state, reload: load }
}

const AdminDataPage = () => {
    const {
        loading,
        error,
        users,
        products,
        orders,
        reviews,
        categories,
        images,
        addresses,
        reload,
    } = useAdminDataTables()

    return (
        <div className="space-y-4">
            <Card className="border-border/80 bg-card/95">
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <CardTitle>Admin data tables</CardTitle>
                        </div>
                        <CardDescription>Snapshot tables for major entities in the API.</CardDescription>
                    </div>
                    <Button type="button" variant="outline" onClick={reload}>
                        <RefreshCcw className="h-4 w-4" />
                        Refresh all
                    </Button>
                </CardHeader>
            </Card>

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

            {!loading && !error && (
                <div className="space-y-4">
                    <TableSection title="Users" rows={users} columns={sectionColumns.users} />
                    <TableSection title="Products" rows={products} columns={sectionColumns.products} />
                    <TableSection title="Orders" rows={orders} columns={sectionColumns.orders} />
                    <TableSection title="Reviews" rows={reviews} columns={sectionColumns.reviews} />
                    <TableSection title="Categories" rows={categories} columns={sectionColumns.categories} />
                    <TableSection title="Images" rows={images} columns={sectionColumns.images} />
                    <TableSection title="Addresses" rows={addresses} columns={sectionColumns.addresses} />
                </div>
            )}
        </div>
    )
}

export default AdminDataPage
