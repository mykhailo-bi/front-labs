import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Category } from '@/lib/api'

type EditCategoryInput = {
    name: string
    slug: string
    parent_id: number | null
}

type EditCategoryModalProps = {
    category: Category
    isSubmitting: boolean
    onValidationError: (message: string) => void
    onUpdate: (id: number, input: EditCategoryInput) => Promise<void>
    onDelete: (id: number) => Promise<void>
}

export function EditCategoryModal({ category, isSubmitting, onValidationError, onUpdate, onDelete }: EditCategoryModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [name, setName] = useState(category.name)
    const [slug, setSlug] = useState(category.slug)
    const [parentId, setParentId] = useState(category.parent_id ? String(category.parent_id) : '')

    useEffect(() => {
        if (!isOpen) {
            return
        }
        setName(category.name)
        setSlug(category.slug)
        setParentId(category.parent_id ? String(category.parent_id) : '')
    }, [isOpen, category])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const parsedParentId = parentId.trim() ? Number.parseInt(parentId, 10) : null
        if (parentId.trim() && (Number.isNaN(parsedParentId) || (parsedParentId ?? 0) < 1)) {
            onValidationError('Parent ID must be a positive integer')
            return
        }
        await onUpdate(category.id, {
            name: name.trim(),
            slug: slug.trim(),
            parent_id: parsedParentId,
        })
        setIsOpen(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size='sm' variant='outline'>
                    Edit
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Category</DialogTitle>
                </DialogHeader>
                <form className='grid gap-3' onSubmit={(event) => void handleSubmit(event)}>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-category-name-${category.id}`}>Name</Label>
                        <Input
                            id={`edit-category-name-${category.id}`}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-category-slug-${category.id}`}>Slug</Label>
                        <Input
                            id={`edit-category-slug-${category.id}`}
                            value={slug}
                            onChange={(event) => setSlug(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-category-parent-${category.id}`}>Parent ID</Label>
                        <Input
                            id={`edit-category-parent-${category.id}`}
                            value={parentId}
                            onChange={(event) => setParentId(event.target.value)}
                            placeholder='Optional'
                        />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <Button type='submit' disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type='button' variant='destructive' disabled={isSubmitting}>
                                    Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete this category.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        variant='destructive'
                                        onClick={() => {
                                            void onDelete(category.id)
                                            setIsOpen(false)
                                        }}
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
