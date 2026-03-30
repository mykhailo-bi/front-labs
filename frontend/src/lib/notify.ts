import { toast } from 'sonner'

const DEFAULT_SUCCESS_DURATION = 2500
const DEFAULT_ERROR_DURATION = 5000

export const notify = {
    success(message: string) {
        toast.success(message, { duration: DEFAULT_SUCCESS_DURATION })
    },
    error(message: string) {
        toast.error(message, { duration: DEFAULT_ERROR_DURATION })
    },
}
