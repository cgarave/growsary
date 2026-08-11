"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  sender?: "user" | "ai" | "system"
}

export function Message({ className, sender = "user", children, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "flex w-full gap-2 py-1.5 animate-in fade-in duration-200",
        sender === "user" ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function MessageAvatar({ className, src, alt = "Avatar", fallback = "AI", ...props }: React.HTMLAttributes<HTMLDivElement> & { src?: string; alt?: string; fallback?: string }) {
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold dark:bg-teal-950 dark:text-teal-300",
        className
      )}
      {...props}
    >
      {src ? <img src={src} alt={alt} className="h-full w-full rounded-full object-cover" /> : fallback}
    </div>
  )
}

export function MessageContent({ className, sender = "user", children, ...props }: React.HTMLAttributes<HTMLDivElement> & { sender?: "user" | "ai" | "system" }) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-xs transition-all",
        sender === "user"
          ? "bg-teal-600 text-white rounded-br-xs font-normal"
          : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-bl-xs border border-zinc-200/80 dark:border-zinc-700/80",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function MessageScroller({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const scrollerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [children])

  return (
    <div
      ref={scrollerRef}
      className={cn(
        "flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scroll-smooth",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
