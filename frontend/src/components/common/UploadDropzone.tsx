import { useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

type UploadDropzoneProps = {
    title: string
    description: string
    accept?: string
    icon: ReactNode
    disabled?: boolean
    onFileSelected: (file: File) => Promise<void> | void
}

export function UploadDropzone({ title, description, accept, icon, disabled = false, onFileSelected }: UploadDropzoneProps) {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    const handleFiles = async (fileList: FileList | null) => {
        const file = fileList?.[0]
        if (!file || disabled) {
            return
        }
        await onFileSelected(file)
    }

    return (
        <Empty
            className={`rounded-lg border-2 border-dashed p-4 transition ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}`}
            onDragOver={(event) => {
                event.preventDefault()
                if (!disabled) {
                    setIsDragging(true)
                }
            }}
            onDragLeave={(event) => {
                event.preventDefault()
                setIsDragging(false)
            }}
            onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                void handleFiles(event.dataTransfer.files)
            }}
        >
            <input
                ref={inputRef}
                type='file'
                accept={accept}
                className='sr-only'
                onChange={(event) => void handleFiles(event.target.files)}
                disabled={disabled}
            />
            <EmptyHeader>
                <EmptyMedia variant='icon'>{icon}</EmptyMedia>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            <Button
                type='button'
                variant='outline'
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
            >
                Select a file to upload
            </Button>
        </Empty>
    )
}
