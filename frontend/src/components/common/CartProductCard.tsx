import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ImageOff, Minus, Plus } from 'lucide-react'
import { fetchImage, type Product } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type CartProductCardProps = {
    product: Product
    count: number
    onDecrement?: () => void
    onIncrement?: () => void
    decrementDisabled?: boolean
    incrementDisabled?: boolean
    actions?: ReactNode
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

export function CartProductCard({
    product,
    count,
    onDecrement,
    onIncrement,
    decrementDisabled,
    incrementDisabled,
    actions,
}: CartProductCardProps) {
    const firstImageId = product.image_ids?.[0] ?? null
    const extraImages = Math.max((product.image_ids?.length ?? 0) - 1, 0)
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [isBrokenImage, setIsBrokenImage] = useState(false)

    useEffect(() => {
        setIsBrokenImage(false)

        if (!firstImageId) {
            setImageUrl(null)
            return
        }

        const cachedUrl = imageUrlCache.get(firstImageId)
        if (cachedUrl !== undefined) {
            setImageUrl(cachedUrl)
            return
        }

        let isActive = true

        void fetchImage(firstImageId)
            .then((image) => {
                if (!isActive) {
                    return
                }
                const resolvedUrl = resolveImageUrl(image.url)
                const finalUrl = resolvedUrl || null
                imageUrlCache.set(firstImageId, finalUrl)
                setImageUrl(finalUrl)
            })
            .catch(() => {
                if (!isActive) {
                    return
                }
                imageUrlCache.set(firstImageId, null)
                setImageUrl(null)
            })

        return () => {
            isActive = false
        }
    }, [firstImageId])

    return (
        <Card className='h-full overflow-hidden py-0 pb-4'>
            <div className='relative aspect-video w-full bg-muted/30'>
                {imageUrl && !isBrokenImage ? (
                    <img
                        src={imageUrl}
                        alt={product.name}
                        className='h-full w-full object-cover'
                        loading='lazy'
                        onError={() => setIsBrokenImage(true)}
                    />
                ) : (
                    <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
                        <ImageOff className='mr-2 size-4' /> No image
                    </div>
                )}
                {extraImages > 0 ? (
                    <span className='absolute right-2 top-2 rounded-full bg-background/90 px-2 py-1 text-xs font-medium shadow'>
                        +{extraImages}
                    </span>
                ) : null}
            </div>
            <CardHeader className='pb-2'>
                <CardTitle className='line-clamp-1 text-base'>{product.name}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2 pt-0'>
                <p className='line-clamp-2 text-sm text-muted-foreground'>
                    {product.description || 'No description available.'}
                </p>
                <div className='flex items-center justify-between'>
                    <p className='text-lg font-semibold'>${product.price}</p>
                    <div className='inline-flex items-center gap-2'>
                        <Button
                            type='button'
                            size='icon-sm'
                            variant='outline'
                            disabled={decrementDisabled}
                            onClick={onDecrement}
                            aria-label={`Decrease ${product.name} quantity`}
                        >
                            <Minus className='size-4' />
                        </Button>
                        <span className='min-w-6 text-center text-sm font-medium'>{count}</span>
                        <Button
                            type='button'
                            size='icon-sm'
                            variant='outline'
                            disabled={incrementDisabled}
                            onClick={onIncrement}
                            aria-label={`Increase ${product.name} quantity`}
                        >
                            <Plus className='size-4' />
                        </Button>
                    </div>
                </div>
                {actions ? <div className='flex flex-wrap gap-2 pt-1'>{actions}</div> : null}
            </CardContent>
        </Card>
    )
}
