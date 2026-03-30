import { Button } from '@/components/ui/button'

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
                onClick={() => onPageChange(page - 1)}
                disabled={!hasPrevious}
            >
                Previous
            </Button>
            <span className='text-sm text-muted-foreground'>Page {page}</span>
            <Button
                variant='outline'
                onClick={() => onPageChange(page + 1)}
                disabled={!hasNext}
            >
                Next
            </Button>
        </div>
    )
}
