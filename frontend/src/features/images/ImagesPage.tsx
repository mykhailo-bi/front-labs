import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2, UploadCloud } from 'lucide-react'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, deleteImage, fetchImages, updateImage, uploadImage, type ImageAsset } from '@/lib/api'
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
    const [editingImageId, setEditingImageId] = useState<number | null>(null)
    const [editError, setEditError] = useState<string | null>(null)
    const [isSavingEdit, setIsSavingEdit] = useState(false)
    const [formAltText, setFormAltText] = useState('')
    const [formTitle, setFormTitle] = useState('')
    const [formCaption, setFormCaption] = useState('')
    const [formFilename, setFormFilename] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [formAriaLabel, setFormAriaLabel] = useState('')

    const editingImage = editingImageId == null ? null : images.find((img) => img.id === editingImageId) ?? null

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

    const openEditModal = (image: ImageAsset) => {
        setEditingImageId(image.id)
        setEditError(null)
        setFormAltText(image.alt_text ?? '')
        setFormTitle(image.title ?? '')
        setFormCaption(image.caption ?? '')
        setFormFilename(image.filename ?? '')
        setFormDescription(image.description ?? '')
        setFormAriaLabel(image.aria_label ?? '')
    }

    const closeEditModal = () => {
        if (isSavingEdit) {
            return
        }
        setEditingImageId(null)
        setEditError(null)
    }

    const onSaveEdit = async () => {
        if (editingImageId == null) {
            return
        }

        const altText = formAltText.trim()
        const title = formTitle.trim()
        const caption = formCaption.trim()
        const filename = formFilename.trim()
        const description = formDescription.trim()
        const ariaLabel = formAriaLabel.trim()

        if (filename.length > 255) {
            setEditError('Filename must be 255 characters or fewer')
            return
        }

        setEditError(null)
        setIsSavingEdit(true)
        try {
            const updated = await updateImage(editingImageId, {
                alt_text: altText || null,
                title: title || null,
                caption: caption || null,
                filename: filename || null,
                description: description || null,
                aria_label: ariaLabel || null,
            })

            setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)))
            setEditingImageId(null)
            notify.success('Image updated')
        } catch (err) {
            const message = parseErrorMessage(err)
            setEditError(message)
            notify.error(message)
        } finally {
            setIsSavingEdit(false)
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
                                <button type='button' className='block w-full text-left' onClick={() => openEditModal(image)}>
                                    <img
                                        src={resolveImageUrl(image.url)}
                                        alt={image.alt_text || `Library image ${image.id}`}
                                        className='aspect-square w-full object-cover transition group-hover:scale-[1.02]'
                                        loading='lazy'
                                    />
                                </button>
                                <div className='absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 p-2 text-xs text-white'>
                                    <span>#{image.id}</span>
                                    <div className='flex items-center gap-1'>
                                        <Button
                                            size='icon-sm'
                                            variant='secondary'
                                            disabled={busyKey === 'upload' || isDeleting}
                                            onClick={() => openEditModal(image)}
                                        >
                                            <Pencil className='size-3' />
                                        </Button>
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
                            </div>
                        )
                    })}
                </div>
                <Dialog open={editingImage != null} onOpenChange={(open) => (!open ? closeEditModal() : undefined)}>
                    <DialogContent className='sm:max-w-xl'>
                        <DialogHeader>
                            <DialogTitle>Edit Image</DialogTitle>
                            <DialogDescription>Update image metadata used for display and accessibility.</DialogDescription>
                        </DialogHeader>
                        <div className='grid gap-3'>
                            {editError ? <p className='text-sm text-destructive'>{editError}</p> : null}
                            <div className='space-y-2'>
                                <Label htmlFor='image-alt-text'>Alt Text</Label>
                                <Input
                                    id='image-alt-text'
                                    value={formAltText}
                                    onChange={(event) => setFormAltText(event.target.value)}
                                    maxLength={255}
                                    placeholder='Describe the image for screen readers'
                                    disabled={isSavingEdit}
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor='image-title'>Title</Label>
                                <Input
                                    id='image-title'
                                    value={formTitle}
                                    onChange={(event) => setFormTitle(event.target.value)}
                                    maxLength={255}
                                    placeholder='Optional display title'
                                    disabled={isSavingEdit}
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor='image-caption'>Caption</Label>
                                <Input
                                    id='image-caption'
                                    value={formCaption}
                                    onChange={(event) => setFormCaption(event.target.value)}
                                    maxLength={512}
                                    placeholder='Optional short caption'
                                    disabled={isSavingEdit}
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor='image-filename'>Filename</Label>
                                <Input
                                    id='image-filename'
                                    value={formFilename}
                                    onChange={(event) => setFormFilename(event.target.value)}
                                    maxLength={255}
                                    placeholder='Display filename'
                                    disabled={isSavingEdit}
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor='image-aria-label'>ARIA Label</Label>
                                <Input
                                    id='image-aria-label'
                                    value={formAriaLabel}
                                    onChange={(event) => setFormAriaLabel(event.target.value)}
                                    maxLength={255}
                                    placeholder='Optional accessibility label'
                                    disabled={isSavingEdit}
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor='image-description'>Description</Label>
                                <Textarea
                                    id='image-description'
                                    value={formDescription}
                                    onChange={(event) => setFormDescription(event.target.value)}
                                    placeholder='Optional long-form description'
                                    disabled={isSavingEdit}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type='button' variant='outline' onClick={closeEditModal} disabled={isSavingEdit}>
                                Cancel
                            </Button>
                            <Button type='button' onClick={() => void onSaveEdit()} disabled={isSavingEdit}>
                                {isSavingEdit ? 'Saving...' : 'Save'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
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
