"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { GameContext } from '@/types/game-context'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatModalProps {
  isOpen: boolean
  onClose: () => void
  getGameContext: () => GameContext
}

export function ChatModal({ isOpen, onClose, getGameContext }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your AI learning assistant for Flight Coach AI. I can help explain machine learning concepts, answer questions about the game, or discuss what you\'re experiencing in the different levels. What would you like to know?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom function - defined early so it can be used in useEffects
  const scrollToBottom = (smooth = true) => {
    // Method 1: Scroll the messages end element into view
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({
          behavior: smooth ? 'smooth' : 'auto',
          block: 'end',
          inline: 'nearest'
        })
        return
      } catch (e) {
        console.log('ScrollIntoView failed, trying fallback method')
      }
    }

    // Method 2: Find the scroll container and scroll to bottom
    if (!scrollAreaRef.current) return

    // Try multiple selectors to find the scrollable container
    const selectors = [
      '[data-radix-scroll-area-viewport]',
      '.scroll-area-viewport',
      '[data-radix-scroll-area-content]'
    ]

    let scrollContainer: Element | null = null

    for (const selector of selectors) {
      scrollContainer = scrollAreaRef.current.querySelector(selector)
      if (scrollContainer) break
    }

    // Fallback to the ScrollArea itself
    if (!scrollContainer) {
      scrollContainer = scrollAreaRef.current
    }

    if (scrollContainer) {
      const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)

      if (smooth) {
        scrollContainer.scrollTo({
          top: maxScrollTop,
          behavior: 'smooth'
        })
      } else {
        // Force immediate scroll - use both methods for reliability
        scrollContainer.scrollTop = maxScrollTop
        // Double-check with requestAnimationFrame
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = maxScrollTop
        })
      }
    }
  }

  useEffect(() => {
    if (isOpen) {
      // Focus input
      if (inputRef.current) {
        inputRef.current.focus()
      }

      // Aggressive scroll to bottom when modal reopens
      // Multiple attempts with increasing delays to ensure DOM is ready
      const scrollAttempts = [50, 150, 300, 500, 800]

      scrollAttempts.forEach((delay, index) => {
        setTimeout(() => {
          scrollToBottom(index === 0) // First attempt is immediate, rest are smooth
        }, delay)
      })
    }
  }, [isOpen])

  // Additional effect specifically for ensuring scroll when modal becomes visible
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      // Use requestAnimationFrame to ensure DOM is rendered
      const scrollWhenReady = () => {
        requestAnimationFrame(() => {
          scrollToBottom(false) // Immediate scroll
          setTimeout(() => scrollToBottom(true), 100) // Follow-up smooth scroll
        })
      }

      // Multiple timing attempts to catch different rendering phases
      setTimeout(scrollWhenReady, 0)
      setTimeout(scrollWhenReady, 200)
      setTimeout(scrollWhenReady, 500)
    }
  }, [isOpen, messages.length])

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    if (messages.length > 0) {
      // Immediate scroll without animation for new messages
      setTimeout(() => scrollToBottom(false), 50)
      // Follow up with smooth scroll for visual feedback
      setTimeout(() => scrollToBottom(true), 200)
    }
  }, [messages.length]) // Only trigger on message count change

  // Additional scroll trigger for loading state changes
  useEffect(() => {
    if (isLoading) {
      setTimeout(() => scrollToBottom(true), 100)
    }
  }, [isLoading])

  // Scroll when error state changes
  useEffect(() => {
    if (error) {
      setTimeout(() => scrollToBottom(true), 100)
    }
  }, [error])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          gameContext: getGameContext()
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      setError('Sorry, I encountered an error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Chat Modal */}
      <Card className="relative w-full max-w-md h-[600px] max-h-[80vh] flex flex-col shadow-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-blue-600" />
            AI Learning Assistant
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Messages Area */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 min-h-0">
            <div className="space-y-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <div className={cn(
                      "text-xs mt-1 opacity-70",
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    )}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-600">Thinking...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}

              {/* Messages end marker for scrolling */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t px-4 py-3">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about machine learning..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}