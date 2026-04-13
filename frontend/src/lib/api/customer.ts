import { authRequest, paginated, request } from '@/lib/api/core'
import type { PaginatedResponse } from '@/lib/api/core'
import type { Address, CartItem, CartSummary, Category, Order, OrderEvent, Product, Review, SavedItem, User, WishlistItem } from '@/lib/api/types'

export async function fetchStoreProducts(
    page = 1,
    pageSize?: number,
    filters?: { category?: string; min_price?: string; max_price?: string; search?: string },
): Promise<PaginatedResponse<Product>> {
    const query = new URLSearchParams({ page: String(page) })
    if (pageSize) {
        query.set('page_size', String(pageSize))
    }
    if (filters?.category) {
        query.set('category', filters.category)
    }
    if (filters?.min_price) {
        query.set('min_price', filters.min_price)
    }
    if (filters?.max_price) {
        query.set('max_price', filters.max_price)
    }
    if (filters?.search) {
        query.set('search', filters.search)
    }

    const data = await request<unknown>(`/products/?${query.toString()}`)
    return paginated<Product>(data)
}

export async function fetchStoreProduct(productId: number): Promise<Product> {
    return request<Product>(`/products/${productId}/`)
}

export async function fetchPublicCategories(page = 1, pageSize?: number): Promise<PaginatedResponse<Category>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await request<unknown>(`/categories/?page=${page}${pageSizeQuery}`)
    return paginated<Category>(data)
}

export async function fetchProductReviews(productId: number, page = 1, pageSize?: number): Promise<PaginatedResponse<Review>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await request<unknown>(`/products/${productId}/reviews/?page=${page}${pageSizeQuery}`)
    return paginated<Review>(data)
}

export async function fetchMe(): Promise<User> {
    return authRequest<User>('/me/')
}

export async function updateMe(payload: Partial<Pick<User, 'username' | 'email' | 'firstname' | 'lastname' | 'description' | 'phone' | 'avatar_id'>>): Promise<User> {
    return authRequest<User>('/me/', {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
}

export async function changePassword(payload: { current_password: string; new_password: string }): Promise<void> {
    await authRequest<void>('/auth/change-password/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function fetchCart(page = 1, pageSize?: number): Promise<PaginatedResponse<CartItem>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/cart/items/?page=${page}${pageSizeQuery}`)
    return paginated<CartItem>(data)
}

export async function upsertCartItem(payload: { product_id: number; count: number }): Promise<CartItem> {
    return authRequest<CartItem>('/cart/items/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function updateCartItem(id: number, payload: { count: number }): Promise<CartItem> {
    return authRequest<CartItem>(`/cart/items/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
}

export async function removeCartItem(id: number): Promise<void> {
    await authRequest<void>(`/cart/items/${id}/`, { method: 'DELETE' })
}

export async function fetchCartSummary(): Promise<CartSummary> {
    return authRequest<CartSummary>('/cart/items/summary/')
}

export async function checkout(payload: {
    shipping_full_name: string
    shipping_phone: string
    shipping_address_line1: string
    shipping_address_line2?: string
    shipping_city: string
    shipping_state?: string
    shipping_postal_code: string
    shipping_country: string
    delivery_method?: string
    payment_method?: string
    contact_phone?: string
}): Promise<Order> {
    return authRequest<Order>('/checkout/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function fetchMyOrders(page = 1, pageSize?: number): Promise<PaginatedResponse<Order>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/orders/?page=${page}${pageSizeQuery}`)
    return paginated<Order>(data)
}

export async function fetchMyOrderTimeline(orderId: number): Promise<OrderEvent[]> {
    return authRequest<OrderEvent[]>(`/orders/${orderId}/timeline/`)
}

export async function fetchMyOrderInvoice(orderId: number): Promise<{ invoice: string }> {
    return authRequest<{ invoice: string }>(`/orders/${orderId}/invoice/`)
}

export async function customerPayOrder(orderId: number, reference_id?: string): Promise<{ order: Order }> {
    return authRequest<{ order: Order }>(`/orders/${orderId}/pay/`, {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId, reference_id: reference_id ?? '' }),
    })
}

export async function customerCancelOrder(orderId: number): Promise<Order> {
    return authRequest<Order>(`/orders/${orderId}/cancel/`, { method: 'POST' })
}

export async function customerRefundOrder(orderId: number, reason: string): Promise<void> {
    await authRequest(`/orders/${orderId}/refund/`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    })
}

export async function fetchAddressesForMe(page = 1, pageSize?: number): Promise<PaginatedResponse<Address>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/addresses/?page=${page}${pageSizeQuery}`)
    return paginated<Address>(data)
}

export async function createAddress(payload: Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Address> {
    return authRequest<Address>('/addresses/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function updateAddress(id: number, payload: Partial<Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<Address> {
    return authRequest<Address>(`/addresses/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
}

export async function deleteAddress(id: number): Promise<void> {
    await authRequest<void>(`/addresses/${id}/`, { method: 'DELETE' })
}

export async function fetchWishlist(page = 1, pageSize?: number): Promise<PaginatedResponse<WishlistItem>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/wishlist/?page=${page}${pageSizeQuery}`)
    return paginated<WishlistItem>(data)
}

export async function addWishlistItem(product_id: number): Promise<WishlistItem> {
    return authRequest<WishlistItem>('/wishlist/', {
        method: 'POST',
        body: JSON.stringify({ product_id }),
    })
}

export async function removeWishlistItem(id: number): Promise<void> {
    await authRequest<void>(`/wishlist/${id}/`, { method: 'DELETE' })
}

export async function fetchSaved(page = 1, pageSize?: number): Promise<PaginatedResponse<SavedItem>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/saved/?page=${page}${pageSizeQuery}`)
    return paginated<SavedItem>(data)
}

export async function addSavedItem(product_id: number): Promise<SavedItem> {
    return authRequest<SavedItem>('/saved/', {
        method: 'POST',
        body: JSON.stringify({ product_id }),
    })
}

export async function removeSavedItem(id: number): Promise<void> {
    await authRequest<void>(`/saved/${id}/`, { method: 'DELETE' })
}

export async function createReview(payload: { product_id: number; rating: number; text: string }): Promise<Review> {
    return authRequest<Review>('/reviews/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}
