import { FileSpreadsheet } from 'lucide-react'
import { UploadDropzone } from '@/components/common/UploadDropzone'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type ProductsCsvModalProps = {
    isSubmitting: boolean
    onExport: () => Promise<void>
    onImport: (file: File) => Promise<void>
}

export function ProductsCsvModal({ isSubmitting, onExport, onImport }: ProductsCsvModalProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant='outline' size='icon' aria-label='Product CSV tools'>
                    <FileSpreadsheet className='size-4' />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Product CSV Tools</DialogTitle>
                    <DialogDescription>Export products and review CSV upload requirements</DialogDescription>
                </DialogHeader>
                <div className='space-y-3'>
                    <Button variant='outline' disabled={isSubmitting} onClick={() => void onExport()}>
                        Export Products CSV
                    </Button>
                    <UploadDropzone
                        icon={<FileSpreadsheet className='size-4' />}
                        title='Product CSV Upload'
                        description='Product import expects a CSV upload containing product inventory rows.'
                        accept='.csv,text/csv'
                        disabled={isSubmitting}
                        onFileSelected={onImport}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
