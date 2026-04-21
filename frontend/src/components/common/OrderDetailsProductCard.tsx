import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { fetchImage, type Product } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type OrderDetailsProductCardProps = {
    productName: string
    product?: Product
    count: number
    currency: string
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

export function OrderDetailsProductCard({ productName, product, count, currency }: OrderDetailsProductCardProps) {
    const unitPrice = Number(product?.price ?? 0)
    const totalPrice = unitPrice * count
    const firstImageId = product?.image_ids?.[0] ?? null
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
        <Card>
            <div className='relative aspect-video w-full rounded-t-lg bg-muted/30'>
                {imageUrl && !isBrokenImage ? (
                    <img
                        src={imageUrl}
                        alt={productName}
                        className='h-full w-full rounded-t-lg object-cover'
                        loading='lazy'
                        onError={() => setIsBrokenImage(true)}
                    />
                ) : (
                    <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
                        <ImageOff className='mr-2 size-4' /> No image
                    </div>
                )}
            </div>
            <CardHeader className='pb-2'>
                <CardTitle className='text-sm'>{productName}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-1 pt-0 text-sm'>
                <p className='text-muted-foreground'>Quantity: {count}</p>
                <p className='text-muted-foreground'>Unit price: {currency} {unitPrice.toFixed(2)}</p>
                <p className='font-medium'>Item total: {currency} {totalPrice.toFixed(2)}</p>
            </CardContent>
        </Card>
    )
}
