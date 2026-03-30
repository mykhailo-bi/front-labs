type LoadingViewProps = {
    text: string
}

export function LoadingView({ text }: LoadingViewProps) {
    return (
        <main className='mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4'>
            <p className='text-sm text-muted-foreground'>{text}</p>
        </main>
    )
}
