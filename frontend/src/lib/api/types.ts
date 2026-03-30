export type User = {
    id: number
    username: string
    email: string
    firstname: string | null
    lastname: string | null
    role: string
    status: string
}

export type Product = {
    id: number
    sku: string | null
    name: string
    description: string | null
    price: string
    status: string
    stock_qty: number
    reserved_qty: number
    is_published: boolean
    availability: string
    image_ids?: number[]
    category_id?: number | null
}

export type ImageAsset = {
    id: number
    url: string
    alt_text: string | null
    title: string | null
    caption: string | null
    filename: string | null
    description: string | null
    aria_label: string | null
    created_at: string
    updated_at: string
}

export type Order = {
    id: number
    user_id: number
    status: string
    total: string
    currency: string
    created_at: string
}

export type OrderEvent = {
    id: number
    order_id: number
    event_type: string
    note: string | null
    created_at: string
}

export type RefundRequest = {
    id: number
    order_id: number
    user_id: number
    reason: string | null
    status: string
    created_at: string
    updated_at: string
}

export type UserInvite = {
    id: number
    email: string
    role: 'admin' | 'customer'
    token: string
    expires_at: string
    accepted_at: string | null
    created_at: string
}

export type Category = {
    id: number
    name: string
    slug: string
    parent_id: number | null
    created_at: string
    updated_at: string
}

export type Review = {
    id: number
    user_id: number
    product_id: number
    rating: number
    text: string
    image_ids: number[]
}

export type Address = {
    id: number
    user_id: number
    label: string
    full_name: string
    phone: string
    line1: string
    line2: string | null
    city: string
    state: string
    postal_code: string
    country: string
    is_default: boolean
    created_at: string
    updated_at: string
}

export type CartItem = {
    id: number
    product_id: number
    count: number
    created_at: string
    updated_at: string
}

export type WishlistItem = {
    id: number
    user_id: number
    product_id: number
    created_at: string
}

export type SavedItem = {
    id: number
    user_id: number
    product_id: number
    created_at: string
}

export type AggregateReport = {
    users: number
    products: number
    orders: number
    paid_orders: number
    revenue: string
    currency: string
    refunds: number
    inventory_risk: number
    mtd_orders: number
}
