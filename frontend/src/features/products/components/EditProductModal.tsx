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
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProductImageManager } from '@/features/products/components/ProductImageManager'
import { Textarea } from '@/components/ui/textarea'
import type { Product } from '@/lib/api'

type EditProductInput = {
    name: string
    sku?: string
    description?: string
    price: string
    stock_qty: number
    is_published: boolean
    image_ids: number[]
}

type EditProductModalProps = {
    product: Product
    isSubmitting: boolean
    onValidationError: (message: string) => void
    onUpdate: (id: number, input: EditProductInput) => Promise<void>
    onDelete: (id: number) => Promise<void>
}

export function EditProductModal({ product, isSubmitting, onValidationError, onUpdate, onDelete }: EditProductModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [name, setName] = useState(product.name)
    const [sku, setSku] = useState(product.sku ?? '')
    const [description, setDescription] = useState(product.description ?? '')
    const [price, setPrice] = useState(product.price)
    const [stock, setStock] = useState(String(product.stock_qty))
    const [isPublished, setIsPublished] = useState(product.is_published)
    const [imageIds, setImageIds] = useState<number[]>(product.image_ids ?? [])

    useEffect(() => {
        if (!isOpen) {
            return
        }
        setName(product.name)
        setSku(product.sku ?? '')
        setDescription(product.description ?? '')
        setPrice(product.price)
        setStock(String(product.stock_qty))
        setIsPublished(product.is_published)
        setImageIds(product.image_ids ?? [])
    }, [isOpen, product])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const stockQty = Number.parseInt(stock, 10)
        if (Number.isNaN(stockQty) || stockQty < 0) {
            onValidationError('Stock quantity must be a non-negative integer')
            return
        }

        await onUpdate(product.id, {
            name: name.trim(),
            sku: sku.trim() || undefined,
            description: description.trim() || undefined,
            price,
            stock_qty: stockQty,
            is_published: isPublished,
            image_ids: imageIds,
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
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>Edit Product</DialogTitle>
                    <DialogDescription>Update inventory directly from admin dashboard</DialogDescription>
                </DialogHeader>
                <form className='grid gap-3 md:grid-cols-2' onSubmit={(event) => void handleSubmit(event)}>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-product-name-${product.id}`}>Name</Label>
                        <Input id={`edit-product-name-${product.id}`} value={name} onChange={(event) => setName(event.target.value)} required />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-product-sku-${product.id}`}>SKU</Label>
                        <Input id={`edit-product-sku-${product.id}`} value={sku} onChange={(event) => setSku(event.target.value)} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-product-price-${product.id}`}>Price</Label>
                        <Input
                            id={`edit-product-price-${product.id}`}
                            type='number'
                            min='0'
                            step='0.01'
                            value={price}
                            onChange={(event) => setPrice(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-product-stock-${product.id}`}>Stock Quantity</Label>
                        <Input
                            id={`edit-product-stock-${product.id}`}
                            type='number'
                            min='0'
                            step='1'
                            value={stock}
                            onChange={(event) => setStock(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2 md:col-span-2'>
                        <Label htmlFor={`edit-product-description-${product.id}`}>Description</Label>
                        <Textarea
                            id={`edit-product-description-${product.id}`}
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
                            id={`edit-product-published-${product.id}`}
                            checked={isPublished}
                            onCheckedChange={(checked) => setIsPublished(checked === true)}
                        />
                        <Label htmlFor={`edit-product-published-${product.id}`}>Published</Label>
                    </div>
                    <div className='flex items-center justify-between gap-2 md:col-span-2'>
                        <Button type='submit' disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Product'}
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type='button' variant='destructive' disabled={isSubmitting}>
                                    Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete this product.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        variant='destructive'
                                        onClick={() => {
                                            void onDelete(product.id)
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
