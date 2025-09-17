import React from 'react'
import { cn } from '@/lib/utils'

interface CoinIconProps {
  className?: string
  size?: number
}

export function CoinIcon({ className, size = 24 }: CoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block", className)}
    >
      <defs>
        <radialGradient id="goldGradient" cx="0.3" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#FFF700"/>
          <stop offset="20%" stopColor="#FFDF00"/>
          <stop offset="40%" stopColor="#FFD700"/>
          <stop offset="60%" stopColor="#FFC700"/>
          <stop offset="80%" stopColor="#DAA520"/>
          <stop offset="100%" stopColor="#B8860B"/>
        </radialGradient>
        <radialGradient id="innerGradient" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#FFEF94"/>
          <stop offset="50%" stopColor="#FFD700"/>
          <stop offset="100%" stopColor="#DAA520"/>
        </radialGradient>
      </defs>

      {/* Outer ring */}
      <circle cx="12" cy="12" r="11" fill="url(#goldGradient)" stroke="#B8860B" strokeWidth="0.5"/>

      {/* Inner circle */}
      <circle cx="12" cy="12" r="8.5" fill="url(#innerGradient)" stroke="#DAA520" strokeWidth="0.3"/>

      {/* Center highlight */}
      <circle cx="12" cy="12" r="6" fill="none" stroke="#FFEF94" strokeWidth="0.5" opacity="0.6"/>

      {/* Top highlight for shine */}
      <ellipse cx="10" cy="8" rx="3" ry="1.5" fill="#FFF700" opacity="0.4"/>

      {/* Dollar sign or coin marking */}
      <text x="12" y="16" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="bold" fill="#B8860B" textAnchor="middle">$</text>
    </svg>
  )
}