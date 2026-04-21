import { useCallback, useEffect, useMemo, useState } from 'react'
import { Heart, Minus, Plus, Trash2 } from 'lucide-react'
import { APP_PATHS } from '@/app/paths'
import { ProductCard } from '@/components/common/ProductCard'
import { ApiError, fetchCart, fetchStoreProducts, fetchWishlist, removeCartItem, removeWishlistItem, updateCartItem, upsertCartItem, type CartItem, type Product, type WishlistItem } from '@/lib/api'
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
    const [cartByProductId, setCartByProductId] = useState<Record<number, CartItem>>({})
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setError(null)
        try {
            const [wishlistRes, productsRes, cartRes] = await Promise.all([fetchWishlist(1, 200), fetchStoreProducts(1, 200), fetchCart(1, 200)])
            setItems(wishlistRes.results)
            const map: Record<number, Product> = {}
            productsRes.results.forEach((product) => {
                map[product.id] = product
            })
            setProductsById(map)
            const cartMap: Record<number, CartItem> = {}
            cartRes.results.forEach((item) => {
                cartMap[item.product_id] = item
            })
            setCartByProductId(cartMap)
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
                        const cartItem = cartByProductId[item.product_id]
                        return (
                            <ProductCard
                                key={item.id}
                                product={product}
                                href={APP_PATHS.productDetails(item.product_id)}
                                actions={(
                                    <>
                                        {!cartItem ? (
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={Boolean(busyKey)}
                                                onClick={(event) => {
                                                    event.preventDefault()
                                                    event.stopPropagation()
                                                    void applyAction(`wishlist:cart:add:${item.id}`, async () => {
                                                        await upsertCartItem({ product_id: item.product_id, count: 1 })
                                                        notify.success('Added to cart')
                                                    })
                                                }}
                                            >
                                                Add to cart
                                            </Button>
                                        ) : null}
                                        {cartItem ? (
                                            <div className='flex items-center gap-1 rounded-md border px-2'>
                                                <Button
                                                    size='icon'
                                                    variant='ghost'
                                                    className='size-7'
                                                    disabled={Boolean(busyKey) || cartItem.count <= 1}
                                                    onClick={(event) => {
                                                        event.preventDefault()
                                                        event.stopPropagation()
                                                        void applyAction(`wishlist:cart:dec:${item.id}`, async () => {
                                                            await updateCartItem(cartItem.id, { count: Math.max(1, cartItem.count - 1) })
                                                            notify.success('Cart item updated')
                                                        })
                                                    }}
                                                >
                                                    <Minus className='size-4' />
                                                </Button>
                                                <span className='min-w-4 text-center text-sm'>{cartItem.count}</span>
                                                <Button
                                                    size='icon'
                                                    variant='ghost'
                                                    className='size-7'
                                                    disabled={Boolean(busyKey)}
                                                    onClick={(event) => {
                                                        event.preventDefault()
                                                        event.stopPropagation()
                                                        void applyAction(`wishlist:cart:inc:${item.id}`, async () => {
                                                            await updateCartItem(cartItem.id, { count: cartItem.count + 1 })
                                                            notify.success('Cart item updated')
                                                        })
                                                    }}
                                                >
                                                    <Plus className='size-4' />
                                                </Button>
                                            </div>
                                        ) : null}
                                        {cartItem ? (
                                            <Button
                                                size='icon'
                                                variant='destructive'
                                                disabled={Boolean(busyKey)}
                                                onClick={(event) => {
                                                    event.preventDefault()
                                                    event.stopPropagation()
                                                    void applyAction(`wishlist:cart:remove:${item.id}`, async () => {
                                                        await removeCartItem(cartItem.id)
                                                        notify.success('Removed from cart')
                                                    })
                                                }}
                                                aria-label='Remove from cart'
                                            >
                                                <Trash2 className='size-4' />
                                            </Button>
                                        ) : null}
                                        <Button
                                            size='icon'
                                            variant='default'
                                            disabled={Boolean(busyKey)}
                                            onClick={(event) => {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                void applyAction(`wishlist:remove:${item.id}`, async () => {
                                                    await removeWishlistItem(item.id)
                                                    notify.success('Removed from wishlist')
                                                })
                                            }}
                                            aria-label='Remove from wishlist'
                                        >
                                            <Heart className='size-4 fill-current' />
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
