import { authFormRequest, authRequest, paginated } from '@/lib/api/core'
import type { ImageAsset, Product } from '@/lib/api/types'
import type { PaginatedResponse } from '@/lib/api/core'

export async function fetchProducts(page = 1, pageSize?: number): Promise<PaginatedResponse<Product>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/products/?page=${page}${pageSizeQuery}`)
    return paginated<Product>(data)
}

export async function createProduct(payload: {
    name: string
    description?: string
    price: string
    stock_qty: number
    sku?: string
    status: string
    is_published: boolean
    availability: string
}): Promise<Product> {
    return authRequest<Product>('/products/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function updateProduct(
    id: number,
    payload: Partial<
        Pick<
            Product,
            'name' | 'status' | 'stock_qty' | 'is_published' | 'availability' | 'price' | 'sku' | 'description' | 'category_id'
        >
    >,
): Promise<Product> {
    return authRequest<Product>(`/products/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
}

export async function archiveProduct(id: number): Promise<Product> {
    return authRequest<Product>(`/products/${id}/archive/`, {
        method: 'POST',
    })
}

export async function deleteProduct(id: number): Promise<void> {
    await authRequest<void>(`/products/${id}/`, {
        method: 'DELETE',
    })
}

export async function setProductImages(id: number, image_ids: number[]): Promise<Product> {
    return authRequest<Product>(`/products/${id}/images/set/`, {
        method: 'POST',
        body: JSON.stringify({ image_ids }),
    })
}

export async function exportProductsCsv(): Promise<string> {
    return authRequest<string>('/products/export/')
}

export async function importProductsCsv(file: File): Promise<{ created: number; updated: number }> {
    const form = new FormData()
    form.append('file', file)
    return authFormRequest<{ created: number; updated: number }>('/products/import/', form)
}

export async function fetchImages(page = 1, pageSize?: number): Promise<PaginatedResponse<ImageAsset>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/images/?page=${page}${pageSizeQuery}`)
    return paginated<ImageAsset>(data)
}

export async function fetchImage(id: number): Promise<ImageAsset> {
    return authRequest<ImageAsset>(`/images/${id}/`)
}

export async function uploadImage(file: File): Promise<ImageAsset> {
    const form = new FormData()
    form.append('file', file)
    return authFormRequest<ImageAsset>('/images/upload/', form)
}

export async function deleteImage(id: number): Promise<void> {
    await authRequest<void>(`/images/${id}/`, { method: 'DELETE' })
}

export async function updateImage(
    id: number,
    payload: Partial<Pick<ImageAsset, 'alt_text' | 'title' | 'caption' | 'filename' | 'description' | 'aria_label'>>,
): Promise<ImageAsset> {
    return authRequest<ImageAsset>(`/images/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
}
