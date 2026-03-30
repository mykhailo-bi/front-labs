import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

type PagerProps = {
    page: number
    hasPrevious: boolean
    hasNext: boolean
    onPageChange: (page: number) => void
}

export function Pager({ page, hasPrevious, hasNext, onPageChange }: PagerProps) {
    return (
        <div className='flex items-center gap-2'>
            <Button
                variant='outline'
                size='icon'
                onClick={() => onPageChange(page - 1)}
                disabled={!hasPrevious}
            >
                <ChevronLeftIcon />
            </Button>
            <span className='text-sm text-muted-foreground'>Page {page}</span>
            <Button
                variant='outline'
                size='icon'
                onClick={() => onPageChange(page + 1)}
                disabled={!hasNext}
            >
                <ChevronRightIcon />
            </Button>
        </div>
    )
}
