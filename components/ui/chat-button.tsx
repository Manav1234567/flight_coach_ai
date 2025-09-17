import React from 'react'
import { MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChatButtonProps {
  isOpen: boolean
  onClick: () => void
  hasUnread?: boolean
  className?: string
}

export function ChatButton({ isOpen, onClick, hasUnread = false, className }: ChatButtonProps) {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110",
        "bg-blue-600 hover:bg-blue-700 text-white border-0",
        "flex items-center justify-center",
        isOpen && "bg-red-500 hover:bg-red-600",
        className
      )}
      size="lg"
    >
      {isOpen ? (
        <X className="h-12 w-12 scale-250" />
      ) : (
        <>
          <MessageCircle className="h-12 w-12 scale-250" style={{ width: '3rem', height: '3rem' }} />
          {hasUnread && (
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <div className="h-2 w-2 bg-white rounded-full" />
            </div>
          )}
        </>
      )}
    </Button>
  )
}