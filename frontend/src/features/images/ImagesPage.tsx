import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2, UploadCloud } from 'lucide-react'
import { UploadDropzone } from '@/components/common/UploadDropzone'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, deleteImage, fetchImages, uploadImage, type ImageAsset } from '@/lib/api'
import { notify } from '@/lib/notify'
import { resolveImageUrl } from '@/features/products/components/ProductImageManager'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.message
    if (error instanceof Error) return error.message
    return 'Unexpected error'
}

export function ImagesPage() {
    const [images, setImages] = useState<ImageAsset[]>([])
    const [error, setError] = useState<string | null>(null)
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [pendingDeleteImageId, setPendingDeleteImageId] = useState<number | null>(null)

    const refresh = useCallback(async () => {
        setError(null)
        try {
            const payload = await fetchImages(1, 64)
            setImages(payload.results)
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const onDelete = async (id: number) => {
        setBusyKey(`delete:${id}`)
        try {
            await deleteImage(id)
            await refresh()
            notify.success('Image deleted')
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setBusyKey(null)
        }
    }

    const onUpload = async (file: File) => {
        setBusyKey('upload')
        try {
            await uploadImage(file)
            await refresh()
            notify.success('Image uploaded')
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setBusyKey(null)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Image Library</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                <UploadDropzone
                    icon={<UploadCloud className='size-4' />}
                    title='Image Library Upload'
                    description='This uploader accepts image asset files (PNG, JPEG, WEBP, GIF) for the shared product image library.'
                    accept='image/png,image/jpeg,image/webp,image/gif'
                    disabled={busyKey === 'upload'}
                    onFileSelected={onUpload}
                />
                <div className='grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6'>
                    {images.map((image) => {
                        const isDeleting = busyKey === `delete:${image.id}`
                        return (
                            <div key={image.id} className='group relative overflow-hidden rounded-lg border bg-muted/20'>
                                <img
                                    src={resolveImageUrl(image.url)}
                                    alt={`Library image ${image.id}`}
                                    className='aspect-square w-full object-cover'
                                    loading='lazy'
                                />
                                <div className='absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 p-2 text-xs text-white'>
                                    <span>#{image.id}</span>
                                    <Button
                                        size='icon-sm'
                                        variant='destructive'
                                        disabled={isDeleting || busyKey === 'upload'}
                                        onClick={() => setPendingDeleteImageId(image.id)}
                                    >
                                        {isDeleting ? <Loader2 className='size-3 animate-spin' /> : <Trash2 className='size-3' />}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <AlertDialog
                    open={pendingDeleteImageId != null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setPendingDeleteImageId(null)
                        }
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Image</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this image from the library.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={busyKey?.startsWith('delete:')}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                variant='destructive'
                                disabled={pendingDeleteImageId == null || busyKey?.startsWith('delete:')}
                                onClick={() => {
                                    if (pendingDeleteImageId == null) {
                                        return
                                    }
                                    void onDelete(pendingDeleteImageId)
                                    setPendingDeleteImageId(null)
                                }}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    )
}
