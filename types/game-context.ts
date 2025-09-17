import type { Level } from "@/app/page"
import type { GameState } from "@/lib/game-engine"

export interface GameContext {
  // Level Information
  currentLevel: Level
  currentStep: number
  levelProgress: Record<Level, {
    dataPointsAchieved: boolean
    modelTrained: boolean
    aiStarted: boolean
  }>

  // Game State
  gameState: GameState
  score: number
  coins: number

  // Progress Information
  dataCount: number
  dataRequirement: {
    min: number
    max?: number
    timeRequired: string
  }

  // Current Activity
  isRecording: boolean
  isAI: boolean
  trainingStatus: string

  // Guidance State
  showGuidance: boolean
  guidanceText: string

  // Unlocked Levels
  unlockedLevels: Level[]
}

export interface ChatContextualRequest {
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  gameContext: GameContext
}