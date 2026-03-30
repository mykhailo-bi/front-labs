import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

type PagerProps = {
    page: number
    totalPages?: number
    hasPrevious: boolean
    hasNext: boolean
    disabled?: boolean
    onPageChange: (page: number) => void
}

export function Pager({ page, totalPages, hasPrevious, hasNext, disabled = false, onPageChange }: PagerProps) {
    const canGoPrevious = hasPrevious && !disabled && page > 1
    const canGoNext = hasNext && !disabled

    return (
        <div className='flex items-center gap-2'>
            <Button
                variant='outline'
                size='icon'
                onClick={() => onPageChange(page - 1)}
                disabled={!canGoPrevious}
            >
                <ChevronLeftIcon />
            </Button>
            <span className='text-sm text-muted-foreground'>
                Page {page}
                {totalPages ? ` of ${totalPages}` : ''}
            </span>
            <Button
                variant='outline'
                size='icon'
                onClick={() => onPageChange(page + 1)}
                disabled={!canGoNext}
            >
                <ChevronRightIcon />
            </Button>
        </div>
    )
}
