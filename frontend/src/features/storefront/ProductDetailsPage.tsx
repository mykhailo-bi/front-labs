import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, ImageOff, Minus, PackagePlus, Plus, Star, Trash2, WalletCards } from 'lucide-react'
import { APP_PATHS } from '@/app/paths'
import { ApiError, addSavedItem, addWishlistItem, createReview, fetchCart, fetchImage, fetchProductReviews, fetchSaved, fetchStoreProduct, fetchWishlist, removeCartItem, removeSavedItem, removeWishlistItem, updateCartItem, upsertCartItem, type CartItem, type Product, type Review, type SavedItem, type WishlistItem } from '@/lib/api'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

function renderStars(average: number) {
    return Array.from({ length: 5 }, (_, index) => {
        const filled = index + 1 <= Math.round(average)
        return <Star key={index} className={`size-4 ${filled ? 'fill-current text-amber-500' : 'text-muted-foreground/40'}`} />
    })
}

const imageUrlCache = new Map<number, string | null>()

function resolveImageUrl(url: string): string {
    if (!url) {
        return ''
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
    const origin = typeof window !== 'undefined' ? window.location.origin : ''

    try {
        const baseUrl = new URL(apiBase, origin)
        return new URL(url, baseUrl.origin).toString()
    } catch {
        return ''
    }
}

export function ProductDetailsPage() {
    const params = useParams<{ productId: string }>()
    const productId = Number(params.productId)
    const [product, setProduct] = useState<Product | null>(null)
    const [reviews, setReviews] = useState<Review[]>([])
    const [nextReviewsPage, setNextReviewsPage] = useState<number | null>(null)
    const [wishlistItem, setWishlistItem] = useState<WishlistItem | null>(null)
    const [savedItem, setSavedItem] = useState<SavedItem | null>(null)
    const [cartItem, setCartItem] = useState<CartItem | null>(null)
    const [rating, setRating] = useState('5')
    const [reviewText, setReviewText] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [imageUrlsById, setImageUrlsById] = useState<Record<number, string | null>>({})
    const [selectedImageId, setSelectedImageId] = useState<number | null>(null)
    const [brokenImageIds, setBrokenImageIds] = useState<number[]>([])

    const averageRating = useMemo(() => {
        if (reviews.length === 0) {
            return 0
        }
        return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    }, [reviews])

    const loadReviews = useCallback(async (page: number, append: boolean) => {
        if (!Number.isFinite(productId) || productId <= 0) {
            return
        }
        const payload = await fetchProductReviews(productId, page, 20)
        setReviews((prev) => (append ? [...prev, ...payload.results] : payload.results))
        setNextReviewsPage(payload.next ? page + 1 : null)
    }, [productId])

    const refresh = useCallback(async () => {
        if (!Number.isFinite(productId) || productId <= 0) {
            setError('Invalid product id')
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)
        try {
            const [productPayload, wishlistPayload, savedPayload, cartPayload] = await Promise.all([
                fetchStoreProduct(productId),
                fetchWishlist(1, 200),
                fetchSaved(1, 200),
                fetchCart(1, 200),
            ])
            setProduct(productPayload)
            setWishlistItem(wishlistPayload.results.find((item) => item.product_id === productId) ?? null)
            setSavedItem(savedPayload.results.find((item) => item.product_id === productId) ?? null)
            setCartItem(cartPayload.results.find((item) => item.product_id === productId) ?? null)
            await loadReviews(1, false)
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setIsLoading(false)
        }
    }, [loadReviews, productId])

    useEffect(() => {
        void refresh()
    }, [refresh])

    useEffect(() => {
        const imageIds = product?.image_ids ?? []
        setBrokenImageIds([])

        if (imageIds.length === 0) {
            setImageUrlsById({})
            setSelectedImageId(null)
            return
        }

        let isActive = true

        void Promise.all(imageIds.map(async (imageId) => {
            const cached = imageUrlCache.get(imageId)
            if (cached !== undefined) {
                return [imageId, cached] as const
            }

            try {
                const image = await fetchImage(imageId)
                const resolved = resolveImageUrl(image.url) || null
                imageUrlCache.set(imageId, resolved)
                return [imageId, resolved] as const
            } catch {
                imageUrlCache.set(imageId, null)
                return [imageId, null] as const
            }
        }))
            .then((pairs) => {
                if (!isActive) {
                    return
                }
                const next: Record<number, string | null> = {}
                pairs.forEach(([id, url]) => {
                    next[id] = url
                })
                setImageUrlsById(next)
                setSelectedImageId((current) => (current && imageIds.includes(current) ? current : imageIds[0]))
            })

        return () => {
            isActive = false
        }
    }, [product])

    const selectedImageUrl = selectedImageId ? imageUrlsById[selectedImageId] : null

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
            <div>
                <Button asChild variant='ghost' size='sm'>
                    <Link to={APP_PATHS.SHOP}>
                        <ArrowLeft className='size-4' />
                        Back to catalog
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{product?.name ?? 'Product details'}</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                    {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                    {isLoading ? <p className='text-sm text-muted-foreground'>Loading product...</p> : null}

                    {product ? (
                        <>
                            <div className='grid gap-4 lg:grid-cols-2'>
                                <div className='space-y-3'>
                                    <div className='aspect-video overflow-hidden rounded-lg border bg-muted/30'>
                                        {selectedImageUrl && !brokenImageIds.includes(selectedImageId ?? -1) ? (
                                            <img
                                                src={selectedImageUrl}
                                                alt={product.name}
                                                className='h-full w-full object-cover'
                                                loading='lazy'
                                                onError={() => {
                                                    if (selectedImageId) {
                                                        setBrokenImageIds((prev) => (prev.includes(selectedImageId) ? prev : [...prev, selectedImageId]))
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
                                                <ImageOff className='mr-2 size-4' /> No image
                                            </div>
                                        )}
                                    </div>
                                    {product.image_ids?.length ? (
                                        <div className='grid grid-cols-4 gap-2 sm:grid-cols-5'>
                                            {product.image_ids.map((imageId) => (
                                                <button
                                                    key={imageId}
                                                    type='button'
                                                    className={`aspect-square overflow-hidden rounded-md border ${selectedImageId === imageId ? 'ring-2 ring-primary' : ''}`}
                                                    onClick={() => setSelectedImageId(imageId)}
                                                >
                                                    {imageUrlsById[imageId] && !brokenImageIds.includes(imageId) ? (
                                                        <img
                                                            src={imageUrlsById[imageId] ?? ''}
                                                            alt={`${product.name} ${imageId}`}
                                                            className='h-full w-full object-cover'
                                                            loading='lazy'
                                                            onError={() => setBrokenImageIds((prev) => (prev.includes(imageId) ? prev : [...prev, imageId]))}
                                                        />
                                                    ) : (
                                                        <div className='flex h-full items-center justify-center text-xs text-muted-foreground'>
                                                            <ImageOff className='size-3' />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>

                                <div className='space-y-3'>
                                    <p className='text-sm text-muted-foreground'>{product.description || 'No description available.'}</p>
                                    <p className='text-2xl font-semibold'>${product.price}</p>
                                    <div className='flex items-center gap-1'>
                                        {renderStars(averageRating)}
                                        <span className='text-sm text-muted-foreground'>
                                            {reviews.length > 0 ? `${averageRating.toFixed(1)} from ${reviews.length} review(s)` : 'No ratings yet'}
                                        </span>
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                        <Button
                                            size='sm'
                                            variant={wishlistItem ? 'default' : 'outline'}
                                            disabled={Boolean(busyKey)}
                                            onClick={() => void applyAction('wishlist', async () => {
                                                if (wishlistItem) {
                                                    await removeWishlistItem(wishlistItem.id)
                                                    notify.success('Removed from wishlist')
                                                    return
                                                }
                                                await addWishlistItem(product.id)
                                                notify.success('Added to wishlist')
                                            })}
                                        >
                                            <Heart className={`size-4 ${wishlistItem ? 'fill-current' : ''}`} /> {wishlistItem ? 'Wishlisted' : 'Wishlist'}
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant={savedItem ? 'default' : 'outline'}
                                            disabled={Boolean(busyKey)}
                                            onClick={() => void applyAction('saved', async () => {
                                                if (savedItem) {
                                                    await removeSavedItem(savedItem.id)
                                                    notify.success('Removed from saved')
                                                    return
                                                }
                                                await addSavedItem(product.id)
                                                notify.success('Saved for later')
                                            })}
                                        >
                                            <WalletCards className={`size-4 ${savedItem ? 'fill-current' : ''}`} /> {savedItem ? 'Saved' : 'Save'}
                                        </Button>
                                        <Button
                                            size='sm'
                                            disabled={Boolean(busyKey)}
                                            onClick={() => void applyAction('cart:add', async () => {
                                                if (cartItem) {
                                                    await removeCartItem(cartItem.id)
                                                    notify.success('Removed from cart')
                                                    return
                                                }
                                                await upsertCartItem({ product_id: product.id, count: 1 })
                                                notify.success('Added to cart')
                                            })}
                                        >
                                            {cartItem ? (
                                                <>
                                                    <Trash2 className='size-4' /> Remove
                                                </>
                                            ) : (
                                                <>
                                                    <PackagePlus className='size-4' /> Add to cart
                                                </>
                                            )}
                                        </Button>
                                        {cartItem ? (
                                            <div className='flex items-center gap-2 rounded-md border px-2 py-1'>
                                                <Button
                                                    size='icon'
                                                    variant='ghost'
                                                    className='size-7'
                                                    disabled={Boolean(busyKey) || cartItem.count <= 1}
                                                    onClick={() => void applyAction('cart:decrement', async () => {
                                                        await updateCartItem(cartItem.id, { count: Math.max(1, cartItem.count - 1) })
                                                        notify.success('Cart item updated')
                                                    })}
                                                >
                                                    <Minus className='size-4' />
                                                </Button>
                                                <span className='min-w-5 text-center text-sm font-medium'>{cartItem.count}</span>
                                                <Button
                                                    size='icon'
                                                    variant='ghost'
                                                    className='size-7'
                                                    disabled={Boolean(busyKey)}
                                                    onClick={() => void applyAction('cart:increment', async () => {
                                                        await updateCartItem(cartItem.id, { count: cartItem.count + 1 })
                                                        notify.success('Cart item updated')
                                                    })}
                                                >
                                                    <Plus className='size-4' />
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className='space-y-3 rounded-lg border p-3'>
                                <p className='text-sm font-medium'>Write a review</p>
                                <div className='grid gap-2 sm:grid-cols-[120px_1fr]'>
                                    <Select value={rating} onValueChange={setRating}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='5'>5 stars</SelectItem>
                                            <SelectItem value='4'>4 stars</SelectItem>
                                            <SelectItem value='3'>3 stars</SelectItem>
                                            <SelectItem value='2'>2 stars</SelectItem>
                                            <SelectItem value='1'>1 star</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} rows={2} placeholder='Share your experience' />
                                </div>
                                <Button
                                    size='sm'
                                    disabled={Boolean(busyKey)}
                                    onClick={() => void applyAction('review:create', async () => {
                                        const text = reviewText.trim()
                                        if (!text) {
                                            notify.error('Review text is required')
                                            return
                                        }
                                        await createReview({ product_id: product.id, rating: Number(rating), text })
                                        setReviewText('')
                                        notify.success('Review posted')
                                    })}
                                >
                                    Post review
                                </Button>
                            </div>

                            <div className='space-y-3'>
                                <p className='text-sm font-medium'>Reviews</p>
                                {reviews.map((review) => (
                                    <div key={review.id} className='rounded-md border p-3'>
                                        <div className='mb-1 flex items-center gap-1'>{renderStars(review.rating)}</div>
                                        <p className='text-sm text-muted-foreground'>{review.text}</p>
                                    </div>
                                ))}
                                {reviews.length === 0 ? <p className='text-sm text-muted-foreground'>No reviews yet.</p> : null}
                                {nextReviewsPage ? (
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        disabled={Boolean(busyKey)}
                                        onClick={() => void applyAction('reviews:next', async () => {
                                            await loadReviews(nextReviewsPage, true)
                                        })}
                                    >
                                        Load more reviews
                                    </Button>
                                ) : null}
                            </div>
                        </>
                    ) : null}
                </CardContent>
            </Card>
        </section>
    )
}
