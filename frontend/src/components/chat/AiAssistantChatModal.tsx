import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Bot, MessageCircle, Send, Sparkles, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const chatSocketUrl = import.meta.env.VITE_AI_CHAT_WS_URL as string | undefined

type ChatMessage = {
    id: number
    role: 'assistant' | 'user'
    content: string
}

function generateAssistantReply(message: string): string {
    const normalized = message.trim().toLowerCase()

    if (normalized.includes('delivery') || normalized.includes('shipping')) {
        return 'Shipping usually takes 2-4 business days. You can track orders from the Orders page once the package leaves the warehouse.'
    }
    if (normalized.includes('return') || normalized.includes('refund')) {
        return 'Returns are available within 14 days for unused products in original packaging. Open your order details and use the Return action to start the process.'
    }
    if (normalized.includes('discount') || normalized.includes('promo')) {
        return 'Promotions are applied during checkout. Add your promo code in the order summary panel before confirming payment.'
    }
    if (normalized.includes('payment')) {
        return 'You can pay with card at checkout. If payment fails, verify card details and billing address, then try again in a few minutes.'
    }
    if (normalized.includes('hello') || normalized.includes('hi')) {
        return 'Hello. I can help with orders, delivery, payment, and account questions.'
    }

    return 'I can help with product search, delivery info, order status, returns, and payments. Share your question in one sentence for a faster answer.'
}

function parseSocketMessage(payload: string): string {
    try {
        const parsed = JSON.parse(payload) as { message?: string; content?: string; reply?: string }
        if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
            return parsed.message
        }
        if (typeof parsed.content === 'string' && parsed.content.trim().length > 0) {
            return parsed.content
        }
        if (typeof parsed.reply === 'string' && parsed.reply.trim().length > 0) {
            return parsed.reply
        }
    } catch {
        return payload
    }

    return payload
}

const initialMessages: ChatMessage[] = [
    {
        id: 1,
        role: 'assistant',
        content: 'Welcome to FrontLabs support. Ask about delivery, refunds, payment, or product availability.',
    },
]

export function AiAssistantChatModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [isAssistantTyping, setIsAssistantTyping] = useState(false)
    const [socketStatus, setSocketStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
    const [socketInfo, setSocketInfo] = useState('')
    const nextIdRef = useRef(2)
    const listRef = useRef<HTMLDivElement>(null)
    const socketRef = useRef<WebSocket | null>(null)
    const pendingMessageRef = useRef<string | null>(null)
    const pendingFallbackTimerRef = useRef<number | null>(null)
    const reconnectTimerRef = useRef<number | null>(null)

    const resolvedSocketUrl = useMemo(() => {
        if (chatSocketUrl && chatSocketUrl.trim().length > 0) {
            return chatSocketUrl
        }
        if (typeof window === 'undefined') {
            return ''
        }
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
        return `${protocol}://${window.location.host}/ws/chat`
    }, [])

    const connectSocket = () => {
        if (!isOpen || !resolvedSocketUrl) {
            return
        }

        const existing = socketRef.current
        if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
            return
        }

        setSocketStatus('connecting')
        setSocketInfo('')
        const socket = new WebSocket(resolvedSocketUrl)
        socketRef.current = socket

        socket.onopen = () => {
            setSocketStatus('connected')
            setSocketInfo('')
            if (pendingFallbackTimerRef.current !== null) {
                window.clearTimeout(pendingFallbackTimerRef.current)
                pendingFallbackTimerRef.current = null
            }
            if (reconnectTimerRef.current !== null) {
                window.clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
            const queued = pendingMessageRef.current
            if (queued) {
                socket.send(JSON.stringify({ message: queued }))
                pendingMessageRef.current = null
            }
        }

        socket.onmessage = (event) => {
            const messageText = parseSocketMessage(String(event.data))
            const assistantMessageId = nextIdRef.current
            nextIdRef.current += 1
            setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: messageText }])
            setIsAssistantTyping(false)
        }

        socket.onclose = (event) => {
            setSocketStatus('disconnected')
            setSocketInfo(`code ${event.code}`)
            if (socketRef.current === socket) {
                socketRef.current = null
            }

            if (isOpen && reconnectTimerRef.current === null) {
                reconnectTimerRef.current = window.setTimeout(() => {
                    reconnectTimerRef.current = null
                    connectSocket()
                }, 1500)
            }

            if (pendingMessageRef.current) {
                const queued = pendingMessageRef.current
                pendingMessageRef.current = null
                if (pendingFallbackTimerRef.current !== null) {
                    window.clearTimeout(pendingFallbackTimerRef.current)
                    pendingFallbackTimerRef.current = null
                }
                const assistantMessage = generateAssistantReply(queued)
                const assistantMessageId = nextIdRef.current
                nextIdRef.current += 1
                setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: assistantMessage }])
                setIsAssistantTyping(false)
            }
        }

        socket.onerror = () => {
            setSocketStatus('disconnected')
            setSocketInfo('connection error')
        }
    }

    useEffect(() => {
        if (!isOpen) {
            return
        }
        const list = listRef.current
        if (!list) {
            return
        }
        list.scrollTop = list.scrollHeight
    }, [isOpen, messages, isAssistantTyping])

    useEffect(() => {
        if (isOpen) {
            return
        }
        setInputValue('')
        setMessages(initialMessages)
        setIsAssistantTyping(false)
        nextIdRef.current = 2
    }, [isOpen])

    useEffect(() => {
        if (isOpen) {
            connectSocket()
        }

        return () => {
            if (reconnectTimerRef.current !== null) {
                window.clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
            if (pendingFallbackTimerRef.current !== null) {
                window.clearTimeout(pendingFallbackTimerRef.current)
                pendingFallbackTimerRef.current = null
            }
            const socket = socketRef.current
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
                socket.close()
            }
            socketRef.current = null
            setSocketStatus('disconnected')
            setSocketInfo('')
        }
    }, [isOpen, resolvedSocketUrl])

    const canSend = useMemo(() => inputValue.trim().length > 0 && !isAssistantTyping, [inputValue, isAssistantTyping])

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const value = inputValue.trim()
        if (!value || isAssistantTyping) {
            return
        }

        const userMessageId = nextIdRef.current
        nextIdRef.current += 1
        setMessages((prev) => [...prev, { id: userMessageId, role: 'user', content: value }])
        setInputValue('')
        setIsAssistantTyping(true)

        const activeSocket = socketRef.current
        if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
            activeSocket.send(JSON.stringify({ message: value }))
            return
        }

        if (resolvedSocketUrl) {
            pendingMessageRef.current = value
            if (pendingFallbackTimerRef.current !== null) {
                window.clearTimeout(pendingFallbackTimerRef.current)
            }
            pendingFallbackTimerRef.current = window.setTimeout(() => {
                const queued = pendingMessageRef.current
                if (!queued) {
                    return
                }
                pendingMessageRef.current = null
                pendingFallbackTimerRef.current = null
                const assistantMessage = generateAssistantReply(queued)
                const assistantMessageId = nextIdRef.current
                nextIdRef.current += 1
                setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: assistantMessage }])
                setIsAssistantTyping(false)
            }, 2500)
            connectSocket()
            return
        }

        const assistantMessage = generateAssistantReply(value)
        const assistantMessageId = nextIdRef.current
        nextIdRef.current += 1

        window.setTimeout(() => {
            setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: assistantMessage }])
            setIsAssistantTyping(false)
        }, 500)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className='fixed right-5 bottom-5 z-40 shadow-lg' size='lg'>
                    <MessageCircle className='size-5' />
                    AI Chat
                </Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Sparkles className='size-4' />
                        AI Shop Assistant
                    </DialogTitle>
                    <DialogDescription>
                        Fast answers for shopping, orders, delivery, and account help.
                    </DialogDescription>
                </DialogHeader>

                <div ref={listRef} className='max-h-80 space-y-3 overflow-y-auto rounded-lg border bg-muted/40 p-3'>
                    <p className='text-xs text-muted-foreground'>
                        {resolvedSocketUrl
                            ? `WebSocket: ${socketStatus}${socketInfo ? ` (${socketInfo})` : ''}`
                            : 'WebSocket disabled (set VITE_AI_CHAT_WS_URL to enable live AI replies)'}
                    </p>
                    {messages.map((message) => (
                        <article
                            key={message.id}
                            className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {message.role === 'assistant' ? <Bot className='mt-1 size-4 shrink-0 text-primary' /> : null}
                            <p
                                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                                    message.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background text-foreground ring-1 ring-border'
                                }`}
                            >
                                {message.content}
                            </p>
                            {message.role === 'user' ? <UserRound className='mt-1 size-4 shrink-0 text-primary' /> : null}
                        </article>
                    ))}
                    {isAssistantTyping ? (
                        <article className='flex items-start gap-2'>
                            <Bot className='mt-1 size-4 shrink-0 text-primary' />
                            <p className='rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground ring-1 ring-border'>
                                Assistant is typing...
                            </p>
                        </article>
                    ) : null}
                </div>

                <form className='flex items-center gap-2' onSubmit={handleSubmit}>
                    <Input
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        placeholder='Type your question here'
                        autoComplete='off'
                    />
                    <Button type='submit' size='icon' disabled={!canSend} aria-label='Send message'>
                        <Send className='size-4' />
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
