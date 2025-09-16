import type * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const baseClasses =
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

  const variantClasses = {
    default: "border-transparent bg-cyan-800 text-white shadow hover:bg-cyan-700",
    secondary: "border-transparent bg-amber-500 text-white hover:bg-amber-600",
    destructive: "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
    outline: "text-slate-900 border-slate-400",
  }

  return <div className={cn(baseClasses, variantClasses[variant], className)} {...props} />
}

export { Badge }
