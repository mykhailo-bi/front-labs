import { useCallback, useEffect, useMemo, useState } from 'react'
import { APP_PATHS } from '@/app/paths'
import { ProductCard } from '@/components/common/ProductCard'
import { ApiError, addWishlistItem, fetchProductReviews, fetchPublicCategories, fetchStoreProducts, fetchWishlist, removeWishlistItem, type Category, type Product, type WishlistItem } from '@/lib/api'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type RatingSummary = {
    average: number
    count: number
}

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

export function StorefrontPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [ratingsByProductId, setRatingsByProductId] = useState<Record<number, RatingSummary>>({})
    const [wishlistByProductId, setWishlistByProductId] = useState<Record<number, WishlistItem>>({})
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [isLoading, setIsLoading] = useState(true)
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const [productsRes, categoriesRes, wishlistRes] = await Promise.all([
                fetchStoreProducts(1, 24, {
                    category: selectedCategory === 'all' ? undefined : selectedCategory,
                    search: search.trim() || undefined,
                }),
                fetchPublicCategories(1, 100),
                fetchWishlist(1, 500),
            ])
            setProducts(productsRes.results)
            setCategories(categoriesRes.results)
            const map: Record<number, WishlistItem> = {}
            wishlistRes.results.forEach((item) => {
                map[item.product_id] = item
            })
            setWishlistByProductId(map)
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setIsLoading(false)
        }
    }, [search, selectedCategory])

    useEffect(() => {
        void refresh()
    }, [refresh])

    useEffect(() => {
        if (products.length === 0) {
            setRatingsByProductId({})
            return
        }

        let isActive = true

        void Promise.all(products.map(async (product) => {
            const payload = await fetchProductReviews(product.id, 1, 50)
            const count = payload.results.length
            const total = payload.results.reduce((sum, review) => sum + review.rating, 0)
            return {
                productId: product.id,
                average: count > 0 ? total / count : 0,
                count,
            }
        }))
            .then((rows) => {
                if (!isActive) {
                    return
                }
                const next: Record<number, RatingSummary> = {}
                rows.forEach((row) => {
                    next[row.productId] = { average: row.average, count: row.count }
                })
                setRatingsByProductId(next)
            })
            .catch(() => {
                if (isActive) {
                    setRatingsByProductId({})
                }
            })

        return () => {
            isActive = false
        }
    }, [products])

    const activeCategoryLabel = useMemo(() => {
        if (selectedCategory === 'all') {
            return 'All categories'
        }
        return categories.find((category) => category.slug === selectedCategory)?.name ?? 'Filtered'
    }, [categories, selectedCategory])

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
        <section className='space-y-4'>
            <Card>
                <CardHeader>
                    <CardTitle>Shop Catalog</CardTitle>
                </CardHeader>
                <CardContent className='grid gap-3 md:grid-cols-3'>
                    <div className='space-y-2 md:col-span-2'>
                        <Label htmlFor='catalog-search'>Search</Label>
                        <Input
                            id='catalog-search'
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder='Search products by name, description, or SKU'
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label>Category</Label>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder='All categories' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>All categories</SelectItem>
                                {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.slug}>{category.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className='md:col-span-3'>
                        <Button disabled={isLoading} onClick={() => void refresh()}>
                            {isLoading ? 'Loading...' : `Apply filters (${activeCategoryLabel})`}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error ? <p className='text-sm text-destructive'>{error}</p> : null}

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {products.map((product) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        href={APP_PATHS.productDetails(product.id)}
                        rating={ratingsByProductId[product.id]}
                        isWishlisted={Boolean(wishlistByProductId[product.id])}
                        wishlistDisabled={Boolean(busyKey)}
                        onToggleWishlist={() => void applyAction(`wishlist:toggle:${product.id}`, async () => {
                            const wishlistItem = wishlistByProductId[product.id]
                            if (wishlistItem) {
                                await removeWishlistItem(wishlistItem.id)
                                notify.success('Removed from wishlist')
                                return
                            }
                            await addWishlistItem(product.id)
                            notify.success('Added to wishlist')
                        })}
                    />
                ))}
            </div>
        </section>
    )
}
