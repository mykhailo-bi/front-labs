import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { UploadDropzone } from '@/components/common/UploadDropzone'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
    ApiError,
    fetchImage,
    fetchImages,
    uploadImage,
    type ImageAsset,
} from '@/lib/api'
import { notify } from '@/lib/notify'

type ProductImageManagerProps = {
    imageIds: number[]
    disabled?: boolean
    onChange: (nextImageIds: number[]) => Promise<void>
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

export function resolveImageUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
    const origin = typeof window !== 'undefined' ? window.location.origin : ''

    try {
        const baseUrl = new URL(apiBase, origin)
        return new URL(url, baseUrl.origin).toString()
    } catch {
        return url
    }
}

export function ProductImageManager({ imageIds, disabled = false, onChange }: ProductImageManagerProps) {
    const [isChooserOpen, setIsChooserOpen] = useState(false)
    const [currentImages, setCurrentImages] = useState<ImageAsset[]>([])
    const [isLoadingCurrent, setIsLoadingCurrent] = useState(false)
    const [currentError, setCurrentError] = useState<string | null>(null)

    const [libraryImages, setLibraryImages] = useState<ImageAsset[]>([])
    const [libraryPage, setLibraryPage] = useState(1)
    const [hasMoreLibrary, setHasMoreLibrary] = useState(false)
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
    const [libraryError, setLibraryError] = useState<string | null>(null)
    const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null)

    const [isSaving, setIsSaving] = useState(false)
    const [removingImageId, setRemovingImageId] = useState<number | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    useEffect(() => {
        let isActive = true

        const loadCurrentImages = async () => {
            if (imageIds.length === 0) {
                setCurrentImages([])
                setCurrentError(null)
                return
            }

            setIsLoadingCurrent(true)
            setCurrentError(null)
            try {
                const imageMap = new Map<number, ImageAsset>()
                const fetched = await Promise.all(imageIds.map((id) => fetchImage(id)))
                for (const image of fetched) {
                    imageMap.set(image.id, image)
                }
                if (!isActive) {
                    return
                }
                setCurrentImages(imageIds.map((id) => imageMap.get(id)).filter((image): image is ImageAsset => Boolean(image)))
            } catch (error) {
                if (!isActive) {
                    return
                }
                const message = parseErrorMessage(error)
                setCurrentError(message)
                notify.error(message)
            } finally {
                if (isActive) {
                    setIsLoadingCurrent(false)
                }
            }
        }

        void loadCurrentImages()
        return () => {
            isActive = false
        }
    }, [imageIds])

    const loadLibrary = async (page: number, append: boolean) => {
        setIsLoadingLibrary(true)
        setLibraryError(null)
        try {
            const payload = await fetchImages(page, 24)
            setLibraryImages((prev) => (append ? [...prev, ...payload.results] : payload.results))
            setLibraryPage(page)
            setHasMoreLibrary(Boolean(payload.next))
        } catch (error) {
            const message = parseErrorMessage(error)
            setLibraryError(message)
            notify.error(message)
        } finally {
            setIsLoadingLibrary(false)
        }
    }

    const openChooser = async (nextOpen: boolean) => {
        setIsChooserOpen(nextOpen)
        if (nextOpen && libraryImages.length === 0) {
            await loadLibrary(1, false)
        }
    }

    const selectedAlreadyLinked = useMemo(() => {
        if (selectedLibraryId == null) {
            return false
        }
        return imageIds.includes(selectedLibraryId)
    }, [imageIds, selectedLibraryId])

    const handleLinkSelected = async () => {
        if (selectedLibraryId == null || selectedAlreadyLinked) {
            return
        }

        setIsSaving(true)
        try {
            await onChange([...imageIds, selectedLibraryId])
            setSelectedLibraryId(null)
            setIsChooserOpen(false)
            notify.success('Image linked to product')
        } finally {
            setIsSaving(false)
        }
    }

    const handleRemove = async (imageId: number) => {
        setRemovingImageId(imageId)
        try {
            await onChange(imageIds.filter((id) => id !== imageId))
            notify.success('Image removed from product')
        } finally {
            setRemovingImageId(null)
        }
    }

    const handleUpload = async (file: File) => {
        setIsUploading(true)
        try {
            const created = await uploadImage(file)
            setLibraryImages((prev) => [created, ...prev])
            await onChange([...imageIds, created.id])
            setIsChooserOpen(false)
            notify.success('Image uploaded and linked')
        } catch (error) {
            const message = parseErrorMessage(error)
            notify.error(message)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className='space-y-3'>
            <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                {isLoadingCurrent ? (
                    <div className='col-span-full rounded-lg border border-dashed p-6 text-sm text-muted-foreground'>Loading images...</div>
                ) : null}

                {!isLoadingCurrent
                    ? currentImages.map((image) => {
                          const isRemoving = removingImageId === image.id
                          return (
                              <div key={image.id} className='group relative overflow-hidden rounded-lg border bg-muted/20'>
                                  <img
                                      src={resolveImageUrl(image.url)}
                                      alt={`Product image ${image.id}`}
                                      className='aspect-square w-full object-cover'
                                      loading='lazy'
                                  />
                                  <div className='absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 p-2 text-xs text-white'>
                                      <span>#{image.id}</span>
                                      <Button
                                          size='icon-sm'
                                          variant='destructive'
                                          disabled={disabled || isRemoving || isSaving}
                                          onClick={() => void handleRemove(image.id)}
                                      >
                                          {isRemoving ? <Loader2 className='size-3 animate-spin' /> : <Trash2 className='size-3' />}
                                      </Button>
                                  </div>
                              </div>
                          )
                      })
                    : null}

                <Dialog open={isChooserOpen} onOpenChange={(nextOpen) => void openChooser(nextOpen)}>
                    <DialogTrigger asChild>
                        <button
                            type='button'
                            className='flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition hover:border-primary hover:bg-primary/10 disabled:opacity-50'
                            disabled={disabled || isSaving}
                            aria-label='Add product image'
                        >
                            <ImagePlus className='size-7' />
                        </button>
                    </DialogTrigger>
                    <DialogContent className='flex h-[80vh] max-h-[80vh] flex-col sm:max-w-3xl'>
                        <DialogHeader>
                            <DialogTitle>Add Product Image</DialogTitle>
                            <DialogDescription>Select from the image library or upload a new file</DialogDescription>
                        </DialogHeader>

                        <div className='flex min-h-0 flex-1 flex-col gap-4'>
                            <div className='rounded-lg border p-3'>
                                <p className='mb-2 text-sm font-medium'>Upload New</p>
                                <UploadDropzone
                                    icon={<UploadCloud className='size-4' />}
                                    title='Product Image Upload'
                                    description='This uploader accepts product image files (PNG, JPEG, WEBP, GIF) to add them to the image library.'
                                    accept='image/png,image/jpeg,image/webp,image/gif'
                                    disabled={isUploading || isSaving}
                                    onFileSelected={handleUpload}
                                />
                            </div>

                            <div className='flex min-h-0 flex-1 flex-col rounded-lg border p-3'>
                                <div className='mb-2 flex items-center justify-between'>
                                    <p className='text-sm font-medium'>Image Library</p>
                                    <Button size='sm' variant='outline' disabled={isLoadingLibrary} onClick={() => void loadLibrary(1, false)}>
                                        Refresh
                                    </Button>
                                </div>

                                <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
                                    {isLoadingLibrary && libraryImages.length === 0 ? (
                                        <p className='text-sm text-muted-foreground'>Loading library...</p>
                                    ) : null}
                                    {libraryError ? <p className='text-sm text-destructive'>{libraryError}</p> : null}

                                    {!isLoadingLibrary && libraryImages.length === 0 ? (
                                        <p className='text-sm text-muted-foreground'>No images in library yet</p>
                                    ) : null}

                                    {libraryImages.length > 0 ? (
                                        <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                                            {libraryImages.map((image) => {
                                                const isSelected = selectedLibraryId === image.id
                                                const isLinked = imageIds.includes(image.id)
                                                return (
                                                    <button
                                                        key={image.id}
                                                        type='button'
                                                        className={`overflow-hidden rounded-lg border text-left transition ${
                                                            isSelected ? 'ring-2 ring-primary' : ''
                                                        } ${isLinked ? 'opacity-60' : 'hover:border-primary/60'}`}
                                                        onClick={() => setSelectedLibraryId(image.id)}
                                                    >
                                                        <img
                                                            src={resolveImageUrl(image.url)}
                                                            alt={`Library image ${image.id}`}
                                                            className='aspect-square w-full object-cover'
                                                            loading='lazy'
                                                        />
                                                        <div className='flex items-center justify-between p-2 text-xs'>
                                                            <span>#{image.id}</span>
                                                            {isLinked ? <span className='text-muted-foreground'>Linked</span> : null}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : null}
                                </div>

                                <div className='mt-3 flex items-center justify-between'>
                                    <Button
                                        size='sm'
                                        variant='outline'
                                        disabled={!hasMoreLibrary || isLoadingLibrary}
                                        onClick={() => void loadLibrary(libraryPage + 1, true)}
                                    >
                                        {isLoadingLibrary ? 'Loading...' : 'Load More'}
                                    </Button>
                                    <Button
                                        size='sm'
                                        disabled={selectedLibraryId == null || selectedAlreadyLinked || isSaving}
                                        onClick={() => void handleLinkSelected()}
                                    >
                                        {selectedAlreadyLinked ? 'Already linked' : isSaving ? 'Linking...' : 'Link selected image'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            {currentError ? <p className='text-sm text-destructive'>{currentError}</p> : null}
        </div>
    )
}
