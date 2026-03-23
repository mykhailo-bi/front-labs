import { useCallback, useEffect, useState } from 'react'
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
import './AdminDataPage.css'

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

const Section = ({ title, count, children }) => (
    <section className="data-section">
        <div className="toolbar compact">
            <h3 className="data-title">{title}</h3>
            <span className="chip">{count} rows</span>
        </div>
        {children}
    </section>
)

const UsersTable = ({ rows }) => (
    <table className="table">
        <thead>
            <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            {rows.map((row) => (
                <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.username}</td>
                    <td>{row.email}</td>
                    <td><span className="chip">{row.role}</span></td>
                    <td>{row.status}</td>
                </tr>
            ))}
        </tbody>
    </table>
)

const ProductsTable = ({ rows }) => (
    <table className="table">
        <thead>
            <tr>
                <th>ID</th>
                <th>SKU</th>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            {rows.map((row) => (
                <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.sku || '-'}</td>
                    <td>{row.name}</td>
                    <td>{row.price}</td>
                    <td>{row.stock_qty}</td>
                    <td>{row.status}</td>
                </tr>
            ))}
        </tbody>
    </table>
)

const OrdersTable = ({ rows }) => (
    <table className="table">
        <thead>
            <tr>
                <th>ID</th>
                <th>User</th>
                <th>Status</th>
                <th>Total</th>
                <th>Created</th>
            </tr>
        </thead>
        <tbody>
            {rows.map((row) => (
                <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.user?.username || row.user || '-'}</td>
                    <td>{row.status}</td>
                    <td>{row.total}</td>
                    <td>{safeDate(row.created_at)}</td>
                </tr>
            ))}
        </tbody>
    </table>
)

const ReviewsTable = ({ rows }) => (
    <table className="table">
        <thead>
            <tr>
                <th>ID</th>
                <th>User</th>
                <th>Product</th>
                <th>Rating</th>
                <th>Comment</th>
            </tr>
        </thead>
        <tbody>
            {rows.map((row) => (
                <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.user?.username || row.user || '-'}</td>
                    <td>{row.product?.name || row.product || '-'}</td>
                    <td>{row.rating}</td>
                    <td className="trim-cell">{row.text || '-'}</td>
                </tr>
            ))}
        </tbody>
    </table>
)

const CategoriesTable = ({ rows }) => (
    <table className="table">
        <thead>
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Parent</th>
                <th>Updated</th>
            </tr>
        </thead>
        <tbody>
            {rows.map((row) => (
                <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.name}</td>
                    <td>{row.slug}</td>
                    <td>{row.parent?.name || row.parent || '-'}</td>
                    <td>{safeDate(row.updated_at)}</td>
                </tr>
            ))}
        </tbody>
    </table>
)

const ImagesTable = ({ rows }) => (
    <table className="table">
        <thead>
            <tr>
                <th>ID</th>
                <th>URL</th>
                <th>Created</th>
            </tr>
        </thead>
        <tbody>
            {rows.map((row) => (
                <tr key={row.id}>
                    <td>{row.id}</td>
                    <td className="trim-cell">{row.url}</td>
                    <td>{safeDate(row.created_at)}</td>
                </tr>
            ))}
        </tbody>
    </table>
)

const AddressesTable = ({ rows }) => (
    <table className="table">
        <thead>
            <tr>
                <th>ID</th>
                <th>User</th>
                <th>Label</th>
                <th>City</th>
                <th>Country</th>
                <th>Default</th>
            </tr>
        </thead>
        <tbody>
            {rows.map((row) => (
                <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.user?.username || row.user || '-'}</td>
                    <td>{row.label || '-'}</td>
                    <td>{row.city}</td>
                    <td>{row.country}</td>
                    <td>{row.is_default ? 'Yes' : 'No'}</td>
                </tr>
            ))}
        </tbody>
    </table>
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
        <div className="page-card">
            <div className="toolbar">
                <div>
                    <h2 className="page-title">Admin data tables</h2>
                    <p className="muted">Snapshot tables for all major entities in the API.</p>
                </div>
                <button type="button" className="btn secondary" onClick={reload}>Refresh all</button>
            </div>

            {loading && <Loader />}
            {error && <div className="error-text">{error}</div>}

            {!loading && !error && (
                <div className="data-grid">
                    <Section title="Users" count={users.length}><UsersTable rows={users} /></Section>
                    <Section title="Products" count={products.length}><ProductsTable rows={products} /></Section>
                    <Section title="Orders" count={orders.length}><OrdersTable rows={orders} /></Section>
                    <Section title="Reviews" count={reviews.length}><ReviewsTable rows={reviews} /></Section>
                    <Section title="Categories" count={categories.length}><CategoriesTable rows={categories} /></Section>
                    <Section title="Images" count={images.length}><ImagesTable rows={images} /></Section>
                    <Section title="Addresses" count={addresses.length}><AddressesTable rows={addresses} /></Section>
                </div>
            )}
        </div>
    )
}

export default AdminDataPage
