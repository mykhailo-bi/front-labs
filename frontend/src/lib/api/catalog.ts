import { authRequest, paginated } from '@/lib/api/core'
import type { Address, CartItem, Category, Review, SavedItem, WishlistItem } from '@/lib/api/types'
import type { PaginatedResponse } from '@/lib/api/core'

export async function fetchCategories(page = 1, pageSize?: number): Promise<PaginatedResponse<Category>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/categories/?page=${page}${pageSizeQuery}`)
    return paginated<Category>(data)
}

export async function createCategory(payload: { name: string; slug: string; parent_id?: number | null }): Promise<Category> {
    return authRequest<Category>('/categories/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function updateCategory(
    id: number,
    payload: Partial<{ name: string; slug: string; parent_id: number | null }>,
): Promise<Category> {
    return authRequest<Category>(`/categories/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
}

export async function deleteCategory(id: number): Promise<void> {
    await authRequest<void>(`/categories/${id}/`, { method: 'DELETE' })
}

export async function fetchReviews(page = 1, pageSize?: number): Promise<PaginatedResponse<Review>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/reviews/?page=${page}${pageSizeQuery}`)
    return paginated<Review>(data)
}

export async function fetchAddresses(page = 1, pageSize?: number): Promise<PaginatedResponse<Address>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/addresses/?page=${page}${pageSizeQuery}`)
    return paginated<Address>(data)
}

export async function fetchCartItems(page = 1, pageSize?: number): Promise<PaginatedResponse<CartItem>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/cart/items/?page=${page}${pageSizeQuery}`)
    return paginated<CartItem>(data)
}

export async function fetchWishlistItems(page = 1, pageSize?: number): Promise<PaginatedResponse<WishlistItem>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/wishlist/?page=${page}${pageSizeQuery}`)
    return paginated<WishlistItem>(data)
}

export async function fetchSavedItems(page = 1, pageSize?: number): Promise<PaginatedResponse<SavedItem>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/saved/?page=${page}${pageSizeQuery}`)
    return paginated<SavedItem>(data)
}
