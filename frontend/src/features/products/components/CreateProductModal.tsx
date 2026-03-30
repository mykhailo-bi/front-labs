import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProductImageManager } from '@/features/products/components/ProductImageManager'
import { Textarea } from '@/components/ui/textarea'

type CreateProductInput = {
    name: string
    sku?: string
    description?: string
    price: string
    stock_qty: number
    is_published: boolean
    image_ids: number[]
}

type CreateProductModalProps = {
    isSubmitting: boolean
    onValidationError: (message: string) => void
    onCreate: (input: CreateProductInput) => Promise<void>
}

const defaultFormState = {
    name: '',
    sku: '',
    description: '',
    price: '0.00',
    stock: '0',
    isPublished: true,
    imageIds: [] as number[],
}

export function CreateProductModal({ isSubmitting, onValidationError, onCreate }: CreateProductModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [name, setName] = useState(defaultFormState.name)
    const [sku, setSku] = useState(defaultFormState.sku)
    const [description, setDescription] = useState(defaultFormState.description)
    const [price, setPrice] = useState(defaultFormState.price)
    const [stock, setStock] = useState(defaultFormState.stock)
    const [isPublished, setIsPublished] = useState(defaultFormState.isPublished)
    const [imageIds, setImageIds] = useState(defaultFormState.imageIds)

    const resetForm = () => {
        setName(defaultFormState.name)
        setSku(defaultFormState.sku)
        setDescription(defaultFormState.description)
        setPrice(defaultFormState.price)
        setStock(defaultFormState.stock)
        setIsPublished(defaultFormState.isPublished)
        setImageIds(defaultFormState.imageIds)
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const stockQty = Number.parseInt(stock, 10)
        if (Number.isNaN(stockQty) || stockQty < 0) {
            onValidationError('Stock quantity must be a non-negative integer')
            return
        }

        await onCreate({
            name: name.trim(),
            sku: sku.trim() || undefined,
            description: description.trim() || undefined,
            price,
            stock_qty: stockQty,
            is_published: isPublished,
            image_ids: imageIds,
        })

        resetForm()
        setIsOpen(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size='icon' aria-label='Create Product'>
                    <Plus className='size-4' />
                </Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>Create Product</DialogTitle>
                    <DialogDescription>Add inventory directly from admin dashboard</DialogDescription>
                </DialogHeader>
                <form className='grid gap-3 md:grid-cols-2' onSubmit={(event) => void handleSubmit(event)}>
                    <div className='space-y-2'>
                        <Label htmlFor='product-name'>Name</Label>
                        <Input id='product-name' value={name} onChange={(event) => setName(event.target.value)} required />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='product-sku'>SKU</Label>
                        <Input id='product-sku' value={sku} onChange={(event) => setSku(event.target.value)} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='product-price'>Price</Label>
                        <Input
                            id='product-price'
                            type='number'
                            min='0'
                            step='0.01'
                            value={price}
                            onChange={(event) => setPrice(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='product-stock'>Stock Quantity</Label>
                        <Input
                            id='product-stock'
                            type='number'
                            min='0'
                            step='1'
                            value={stock}
                            onChange={(event) => setStock(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2 md:col-span-2'>
                        <Label htmlFor='product-description'>Description</Label>
                        <Textarea
                            id='product-description'
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                        />
                    </div>
                    <div className='space-y-2 md:col-span-2'>
                        <Label>Images</Label>
                        <ProductImageManager imageIds={imageIds} disabled={isSubmitting} onChange={async (nextImageIds) => setImageIds(nextImageIds)} />
                    </div>
                    <div className='flex items-center gap-2 md:col-span-2'>
                        <Checkbox
                            id='product-published'
                            checked={isPublished}
                            onCheckedChange={(checked) => setIsPublished(checked === true)}
                        />
                        <Label htmlFor='product-published'>Published</Label>
                    </div>
                    <div className='md:col-span-2'>
                        <Button type='submit' disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Product'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
