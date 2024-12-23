import { Toast } from "@/components/ui/toast"

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastProps["variant"]
}

export function toast(options: ToastOptions) {
  const { title, description, variant } = options

  return {
    title,
    description,
    variant,
  }
} 