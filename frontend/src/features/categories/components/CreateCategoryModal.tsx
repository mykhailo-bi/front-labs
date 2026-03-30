import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type CreateCategoryInput = {
    name: string
    slug: string
    parent_id?: number
}

type CreateCategoryModalProps = {
    isSubmitting: boolean
    onValidationError: (message: string) => void
    onCreate: (input: CreateCategoryInput) => Promise<void>
}

export function CreateCategoryModal({ isSubmitting, onValidationError, onCreate }: CreateCategoryModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [name, setName] = useState('')
    const [slug, setSlug] = useState('')
    const [parentId, setParentId] = useState('')

    const reset = () => {
        setName('')
        setSlug('')
        setParentId('')
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const parsedParentId = parentId.trim() ? Number.parseInt(parentId, 10) : undefined
        if (parentId.trim() && (parsedParentId == null || Number.isNaN(parsedParentId) || parsedParentId < 1)) {
            onValidationError('Parent ID must be a positive integer')
            return
        }

        await onCreate({
            name: name.trim(),
            slug: slug.trim(),
            parent_id: parsedParentId,
        })

        reset()
        setIsOpen(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size='icon' aria-label='Create Category'>
                    <Plus className='size-4' />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Category</DialogTitle>
                </DialogHeader>
                <form className='grid gap-3' onSubmit={(event) => void handleSubmit(event)}>
                    <div className='space-y-2'>
                        <Label htmlFor='category-name'>Name</Label>
                        <Input id='category-name' value={name} onChange={(event) => setName(event.target.value)} required />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='category-slug'>Slug</Label>
                        <Input id='category-slug' value={slug} onChange={(event) => setSlug(event.target.value)} required />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='category-parent-id'>Parent ID</Label>
                        <Input id='category-parent-id' value={parentId} onChange={(event) => setParentId(event.target.value)} placeholder='Optional' />
                    </div>
                    <div>
                        <Button type='submit' disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Category'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
