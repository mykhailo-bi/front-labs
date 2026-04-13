import { useCallback, useEffect, useMemo, useState } from 'react'
import { APP_PATHS } from '@/app/paths'
import { ProductCard } from '@/components/common/ProductCard'
import { ApiError, fetchStoreProducts, fetchWishlist, removeWishlistItem, upsertCartItem, type Product, type WishlistItem } from '@/lib/api'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

function fallbackProduct(productId: number): Product {
    return {
        id: productId,
        sku: null,
        name: `Product #${productId}`,
        description: 'This item is currently unavailable in the public catalog.',
        price: '0.00',
        status: 'unavailable',
        stock_qty: 0,
        reserved_qty: 0,
        is_published: false,
        availability: 'discontinued',
        image_ids: [],
    }
}

export function WishlistPage() {
    const [items, setItems] = useState<WishlistItem[]>([])
    const [productsById, setProductsById] = useState<Record<number, Product>>({})
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setError(null)
        try {
            const [wishlistRes, productsRes] = await Promise.all([fetchWishlist(1, 200), fetchStoreProducts(1, 200)])
            setItems(wishlistRes.results)
            const map: Record<number, Product> = {}
            productsRes.results.forEach((product) => {
                map[product.id] = product
            })
            setProductsById(map)
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const totalValue = useMemo(() => items.reduce((sum, item) => sum + Number(productsById[item.product_id]?.price ?? 0), 0), [items, productsById])

    const applyAction = async (key: string, callback: () => Promise<void>) => {
        setBusyKey(key)
        try {
            await callback()
            await refresh()
        } catch (err) {
            notify.error(parseErrorMessage(err))
        } finally {
            setBusyKey(null)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Wishlist ({items.length})</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
                {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                <p className='text-sm text-muted-foreground'>Estimated value: ${totalValue.toFixed(2)}</p>
                <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                    {items.map((item) => {
                        const product = productsById[item.product_id] ?? fallbackProduct(item.product_id)
                        return (
                            <ProductCard
                                key={item.id}
                                product={product}
                                href={APP_PATHS.productDetails(item.product_id)}
                                actions={(
                                    <>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={Boolean(busyKey)}
                                            onClick={(event) => {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                void applyAction(`wishlist:cart:${item.id}`, async () => {
                                                    await upsertCartItem({ product_id: item.product_id, count: 1 })
                                                    notify.success('Added to cart')
                                                })
                                            }}
                                        >
                                            Add to cart
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='destructive'
                                            disabled={Boolean(busyKey)}
                                            onClick={(event) => {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                void applyAction(`wishlist:remove:${item.id}`, async () => {
                                                    await removeWishlistItem(item.id)
                                                    notify.success('Removed from wishlist')
                                                })
                                            }}
                                        >
                                            Remove
                                        </Button>
                                    </>
                                )}
                            />
                        )
                    })}
                </div>
                {items.length === 0 ? <p className='text-sm text-muted-foreground'>No wishlist items yet.</p> : null}
            </CardContent>
        </Card>
    )
}
