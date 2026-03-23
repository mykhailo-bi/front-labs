import { Badge } from '../components/ui/badge'
import { listUsers } from '../services/userService'
import {
    listAddresses,
    listCategories,
    listImages,
    listOrders,
    listProducts,
    listReviews,
} from '../services/adminService'

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

const SECTION_DEFINITIONS = {
    users: {
        key: 'users',
        title: 'Users',
        description: 'User accounts, roles, and account status snapshot.',
        load: () => listUsers({ page_size: PAGE_SIZE }),
        columns: [
            { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
            { header: 'Username', render: (row) => row.username, className: 'font-medium' },
            { header: 'Email', render: (row) => row.email, className: 'text-muted-foreground' },
            { header: 'Role', render: (row) => <Badge variant={roleVariant(row.role)}>{row.role}</Badge> },
            { header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
        ],
    },
    products: {
        key: 'products',
        title: 'Products',
        description: 'Catalog inventory, pricing, and stock position.',
        load: () => listProducts({ page_size: PAGE_SIZE, ordering: '-created_at' }),
        columns: [
            { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
            { header: 'SKU', render: (row) => row.sku || '-', className: 'text-muted-foreground' },
            { header: 'Name', render: (row) => row.name, className: 'font-medium' },
            { header: 'Price', render: (row) => row.price },
            { header: 'Stock', render: (row) => row.stock_qty },
            { header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
        ],
    },
    orders: {
        key: 'orders',
        title: 'Orders',
        description: 'Recent order flow with state and total values.',
        load: () => listOrders({ page_size: PAGE_SIZE, ordering: '-created_at' }),
        columns: [
            { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
            { header: 'User', render: (row) => row.user?.username || row.user || '-' },
            { header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
            { header: 'Total', render: (row) => row.total },
            { header: 'Created', render: (row) => safeDate(row.created_at), className: 'text-muted-foreground' },
        ],
    },
    reviews: {
        key: 'reviews',
        title: 'Reviews',
        description: 'Product review ratings and customer feedback.',
        load: () => listReviews({ page_size: PAGE_SIZE, ordering: '-id' }),
        columns: [
            { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
            { header: 'User', render: (row) => row.user?.username || row.user || '-' },
            { header: 'Product', render: (row) => row.product?.name || row.product || '-' },
            { header: 'Rating', render: (row) => row.rating },
            { header: 'Comment', render: (row) => row.text || '-', className: CELL_TRIM },
        ],
    },
    categories: {
        key: 'categories',
        title: 'Categories',
        description: 'Category hierarchy and recent update activity.',
        load: () => listCategories({ page_size: PAGE_SIZE, ordering: '-updated_at' }),
        columns: [
            { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
            { header: 'Name', render: (row) => row.name, className: 'font-medium' },
            { header: 'Slug', render: (row) => row.slug, className: 'text-muted-foreground' },
            { header: 'Parent', render: (row) => row.parent?.name || row.parent || '-' },
            { header: 'Updated', render: (row) => safeDate(row.updated_at), className: 'text-muted-foreground' },
        ],
    },
    images: {
        key: 'images',
        title: 'Images',
        description: 'Uploaded image assets and creation timeline.',
        load: () => listImages({ page_size: PAGE_SIZE, ordering: '-created_at' }),
        columns: [
            { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
            { header: 'URL', render: (row) => row.url, className: CELL_TRIM },
            { header: 'Created', render: (row) => safeDate(row.created_at), className: 'text-muted-foreground' },
        ],
    },
    addresses: {
        key: 'addresses',
        title: 'Addresses',
        description: 'Saved customer addresses and default flags.',
        load: () => listAddresses({ page_size: PAGE_SIZE, ordering: '-updated_at' }),
        columns: [
            { header: 'ID', render: (row) => `#${row.id}`, className: 'font-mono text-xs' },
            { header: 'User', render: (row) => row.user?.username || row.user || '-' },
            { header: 'Label', render: (row) => row.label || '-' },
            { header: 'City', render: (row) => row.city },
            { header: 'Country', render: (row) => row.country },
            { header: 'Default', render: (row) => (row.is_default ? 'Yes' : 'No') },
        ],
    },
}

const DATA_SECTIONS = Object.values(SECTION_DEFINITIONS).map((section) => ({
    key: section.key,
    title: section.title,
    description: section.description,
}))

const getDataSection = (sectionId) => SECTION_DEFINITIONS[sectionId] || null

export {
    DATA_SECTIONS,
    PAGE_SIZE,
    getDataSection,
    normalizeListPayload,
}
