"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="bottom-center"
    toastOptions={{
      classNames: {
        toast: "!rounded-lg !border-border !bg-foreground !text-background !shadow-lg",
        description: "!text-background/70",
      },
    }}
    {...props}
  />
)

export { Toaster }
