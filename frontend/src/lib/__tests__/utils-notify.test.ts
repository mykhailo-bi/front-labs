import { describe, expect, it, vi } from 'vitest'

import { toast } from 'sonner'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

describe('utils and notify', () => {
    it('cn merges class names and resolves tailwind conflicts', () => {
        expect(cn('px-2', 'px-4', false && 'hidden', 'text-sm')).toBe('px-4 text-sm')
    })

    it('notify.success sends success toast with duration', () => {
        notify.success('Done')

        expect(toast.success).toHaveBeenCalledWith('Done', { duration: 2500 })
    })

    it('notify.error sends error toast with duration', () => {
        notify.error('Failed')

        expect(toast.error).toHaveBeenCalledWith('Failed', { duration: 5000 })
    })
})
