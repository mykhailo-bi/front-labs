import { FileSpreadsheet } from 'lucide-react'
import { UploadDropzone } from '@/components/common/UploadDropzone'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type UsersCsvModalProps = {
    isSubmitting: boolean
    onExport: () => Promise<void>
    onImport: (file: File) => Promise<void>
}

export function UsersCsvModal({ isSubmitting, onExport, onImport }: UsersCsvModalProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant='outline' size='icon' aria-label='User CSV tools'>
                    <FileSpreadsheet className='size-4' />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>User CSV Tools</DialogTitle>
                    <DialogDescription>Export users and review CSV upload requirements</DialogDescription>
                </DialogHeader>
                <div className='space-y-3'>
                    <Button variant='outline' disabled={isSubmitting} onClick={() => void onExport()}>
                        Export Users CSV
                    </Button>
                    <UploadDropzone
                        icon={<FileSpreadsheet className='size-4' />}
                        title='User CSV Upload'
                        description='User import expects a CSV upload containing user account rows.'
                        accept='.csv,text/csv'
                        disabled={isSubmitting}
                        onFileSelected={onImport}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
