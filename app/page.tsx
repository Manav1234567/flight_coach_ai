"use client"

import { useState, useEffect, useRef } from "react"
import { GameCanvas } from "@/components/game-canvas"
import { ControlPanel } from "@/components/control-panel"
import type { GameEngine, GameState } from "@/lib/game-engine"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, Gamepad2, Settings, Trophy, Zap, AlertTriangle, X, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CoinIcon } from "@/components/ui/coin-icon"
import { ChatButton } from "@/components/ui/chat-button"
import { ChatModal } from "@/components/ui/chat-modal"
import type { GameContext } from "@/types/game-context"

export type Level = "finetuning" | "underfitting" | "overfitting"

const levelData = {
  finetuning: {
    title: "Level 1: Fine-tuning",
    description: "Give AI plenty of examples to learn well",
    icon: Trophy,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    borderColor: "border-green-200 dark:border-green-800",
    minDataPoints: 450,
    maxDataPoints: null,
    samePipeLength: false,
    instructions: [
      "Record 45 seconds of gameplay to give AI lots of examples",
      "More examples = smarter AI that plays better",
      "This shows how AI learns best with enough training data",
    ],
  },
  underfitting: {
    title: "Level 2: Underfitting",
    description: "What happens when AI doesn't get enough practice",
    icon: AlertTriangle,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    borderColor: "border-orange-200 dark:border-orange-800",
    minDataPoints: 50,
    maxDataPoints: null,
    samePipeLength: false,
    instructions: [
      "Record only 5 seconds - very few examples for AI",
      "Watch how AI struggles with so little training data",
      "Like trying to learn driving from just one lesson!",
    ],
  },
  overfitting: {
    title: "Level 3: Overfitting",
    description: "AI memorizes patterns but fails on new situations",
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    borderColor: "border-purple-200 dark:border-purple-800",
    minDataPoints: 200,
    maxDataPoints: null,
    samePipeLength: true,
    instructions: [
      "You get identical pipe patterns during recording",
      "But AI is tested on random patterns it's never seen",
      "Shows how memorizing ≠ true understanding",
    ],
  },
}

export default function FlappyMLGame() {
  const [gameEngine, setGameEngine] = useState<GameEngine | null>(null)
  const gameEngineRef = useRef<GameEngine | null>(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [dataCount, setDataCount] = useState(0)
  const [gameState, setGameState] = useState<GameState>("menu")
  const [trainingStatus, setTrainingStatus] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isAI, setIsAI] = useState(false)
  const [currentLevel, setCurrentLevel] = useState<Level>("finetuning")
  const [isKickoff, setIsKickoff] = useState(true)
  const [showGuidance, setShowGuidance] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)
  const [visitedLevels, setVisitedLevels] = useState<Set<Level>>(new Set(["finetuning"]))
  const [guidanceCompletedLevels, setGuidanceCompletedLevels] = useState<Set<Level>>(new Set())
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [showChatHint, setShowChatHint] = useState(true)
  const [isClient, setIsClient] = useState(false)

  // Track animation triggers for current session to prevent multiple triggers
  const animationTriggeredRef = useRef<Record<Level, boolean>>({
    finetuning: false,
    underfitting: false,
    overfitting: false,
  })

  // Debug guidance state
  useEffect(() => {
    console.log(`[Guidance Debug] showGuidance: ${showGuidance}, currentStep: ${currentStep}, isKickoff: ${isKickoff}`)
  }, [showGuidance, currentStep, isKickoff])

  // Debug currentLevel changes
  useEffect(() => {
    console.log(`[Level Debug] currentLevel changed to: ${currentLevel}`)
  }, [currentLevel])

  // Debug visitedLevels changes
  useEffect(() => {
    console.log(`[Level Debug] visitedLevels changed to:`, Array.from(visitedLevels))
  }, [visitedLevels])

  // Developer function to reset level progress (for testing)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "R") {
        event.preventDefault()
        console.log(`[Dev] Resetting progress for ${currentLevel}`)
        animationTriggeredRef.current[currentLevel] = false
        setLevelProgress((prev) => ({
          ...prev,
          [currentLevel]: { dataPointsAchieved: false, modelTrained: false, aiStarted: false },
        }))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentLevel])

  const [coins, setCoins] = useState(0)
  const [levelProgress, setLevelProgress] = useState<
    Record<
      Level,
      {
        dataPointsAchieved: boolean
        modelTrained: boolean
        aiStarted: boolean
      }
    >
  >({
    finetuning: { dataPointsAchieved: false, modelTrained: false, aiStarted: false },
    underfitting: { dataPointsAchieved: false, modelTrained: false, aiStarted: false },
    overfitting: { dataPointsAchieved: false, modelTrained: false, aiStarted: false },
  })

  useEffect(() => {
    setIsClient(true)

    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("flappyml-level-progress")
      const guidanceDismissed = localStorage.getItem("flappyml-guidance-dismissed")
      const savedVisitedLevels = localStorage.getItem("flappyml-visited-levels")
      const savedGuidanceCompleted = localStorage.getItem("flappyml-guidance-completed")
      const chatHintDismissed = localStorage.getItem("flappyml-chat-hint-dismissed")

      console.log("[Guidance] localStorage check:", {
        guidanceDismissed,
        savedGuidanceCompleted,
        currentLevel,
        chatHintDismissed
      })

      // Set chat hint visibility immediately on mount
      if (chatHintDismissed) {
        setShowChatHint(false)
      }

      // Remove global guidance dismissal - guidance is now per-level
      // if (guidanceDismissed) {
      //   console.log("[Guidance] Hiding guidance due to global dismissal")
      //   setShowGuidance(false)
      // }

      if (savedVisitedLevels) {
        try {
          const parsedVisitedLevels = JSON.parse(savedVisitedLevels)
          console.log("[Guidance] Loading visited levels from localStorage:", parsedVisitedLevels)
          setVisitedLevels(new Set(parsedVisitedLevels))
        } catch (e) {
          console.error("Failed to parse visited levels:", e)
        }
      } else {
        console.log("[Guidance] No saved visited levels found, starting with finetuning only")
      }

      // Don't load guidance completion from localStorage - make it session-based
      // This ensures guidance shows during first-time play of each session
      console.log(`[Guidance] Guidance completion is session-based - not loading from localStorage`)

      // Guidance will be controlled by the separate useEffect that handles level changes

      if (saved) {
        try {
          const parsedProgress = JSON.parse(saved)
          setLevelProgress(parsedProgress)

          // Don't automatically hide guidance based on progress - let visitedLevels handle it
        } catch (e) {
          console.error("Failed to parse saved progress:", e)
        }
      }
    }
  }, []) // Only run on component mount, not on currentLevel changes

  // Handle guidance visibility when level changes
  useEffect(() => {
    // Only show guidance for level 1 (finetuning) on the very first visit and if not dismissed
    const isFirstTimeVisit = currentLevel === "finetuning" && visitedLevels.size === 1 && visitedLevels.has("finetuning")
    const notDismissedThisSession = !guidanceCompletedLevels.has("finetuning")

    if (currentLevel === "finetuning" && isFirstTimeVisit && notDismissedThisSession) {
      console.log(`[Guidance] Showing guidance for ${currentLevel} (very first visit)`)
      setShowGuidance(true)
    } else if (currentLevel !== "finetuning") {
      console.log(`[Guidance] Hiding guidance because current level is ${currentLevel}, not finetuning`)
      setShowGuidance(false)
    } else if (!isFirstTimeVisit && currentLevel === "finetuning") {
      console.log(`[Guidance] Hiding guidance because ${currentLevel} has been visited before (visitedLevels: ${Array.from(visitedLevels)})`)
      setShowGuidance(false)
    } else if (guidanceCompletedLevels.has("finetuning")) {
      console.log(`[Guidance] Hiding guidance because completed for ${currentLevel} in this session`)
      setShowGuidance(false)
    }
  }, [currentLevel, guidanceCompletedLevels, visitedLevels])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("flappyml-level-progress", JSON.stringify(levelProgress))
    }
    const totalCoins = Object.values(levelProgress).reduce((total, progress) => {
      return (
        total + (progress.dataPointsAchieved ? 5 : 0) + (progress.modelTrained ? 5 : 0) + (progress.aiStarted ? 5 : 0)
      )
    }, 0)
    setCoins(totalCoins)
  }, [levelProgress])

  // Save visited levels to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const levelsArray = Array.from(visitedLevels)
      console.log("[Guidance] Saving visited levels to localStorage:", levelsArray)
      localStorage.setItem("flappyml-visited-levels", JSON.stringify(levelsArray))
    }
  }, [visitedLevels])

  // Don't save guidance completed levels to localStorage - keep it session-based
  // useEffect(() => {
  //   if (typeof window !== "undefined") {
  //     localStorage.setItem("flappyml-guidance-completed", JSON.stringify(Array.from(guidanceCompletedLevels)))
  //   }
  // }, [guidanceCompletedLevels])

  // Separate useEffect for guidance step calculation
  useEffect(() => {
    if (showGuidance) {
      const currentLevelData = levelProgress[currentLevel]
      let newStep = 1

      if (!currentLevelData.dataPointsAchieved) {
        newStep = dataCount === 0 ? 1 : 2 // Start recording or recording in progress
      } else if (!currentLevelData.modelTrained) {
        newStep = 3 // Need to train model
      } else if (!currentLevelData.aiStarted) {
        newStep = 4 // Need to start AI
      } else {
        newStep = 5 // Level complete!
      }

      if (newStep !== currentStep) {
        setCurrentStep(newStep)
        console.log(`[Guidance] Updated to step ${newStep} for level ${currentLevel}, dataCount: ${dataCount}`)
      }
    }
  }, [showGuidance, levelProgress, currentLevel, dataCount, currentStep])

  const handleGameEngineReady = (engine: GameEngine) => {
    setGameEngine(engine)
    gameEngineRef.current = engine
    setDataCount(engine.dataset.length)
    setHighScore(engine.highScore)
    engine.setLevel(currentLevel)

    engine.onStatusUpdate = (status: string) => {
      setTrainingStatus(status)
    }
  }

  const handleScoreUpdate = (newScore: number) => {
    setScore(newScore)
  }

  const handleDataCountUpdate = (count: number) => {
    // Get current level from game engine ref instead of closure
    const actualCurrentLevel = gameEngineRef.current?.currentLevel || currentLevel

    setDataCount(count)
    console.log(`[DataCount] Level: ${actualCurrentLevel}, Count: ${count}`)
    console.log(`[DataCount] TIMESTAMP: ${new Date().toISOString()}, Level State: ${actualCurrentLevel}`)
    console.log(`[DataCount] Closure currentLevel: ${currentLevel}, Engine currentLevel: ${gameEngine?.currentLevel}, EngineRef currentLevel: ${gameEngineRef.current?.currentLevel}`)

    const currentLevelConfig = levelData[actualCurrentLevel]
    const isDataSufficient = actualCurrentLevel === "underfitting" ? count === 50 : count >= currentLevelConfig.minDataPoints
    const alreadyAchieved = levelProgress[actualCurrentLevel].dataPointsAchieved
    const animationAlreadyTriggered = animationTriggeredRef.current[actualCurrentLevel]

    console.log(`[DataCount] isDataSufficient: ${isDataSufficient}, alreadyAchieved: ${alreadyAchieved}, animationTriggered: ${animationAlreadyTriggered}`)
    console.log(`[DataCount] threshold: ${actualCurrentLevel === "underfitting" ? 50 : currentLevelConfig.minDataPoints}`)
    console.log(`[DataCount] condition check: isDataSufficient && !alreadyAchieved && !animationAlreadyTriggered = ${isDataSufficient && !alreadyAchieved && !animationAlreadyTriggered}`)
    console.log(`[DataCount] levelProgress for ${actualCurrentLevel}:`, levelProgress[actualCurrentLevel])
    console.log(`[DataCount] Level-specific check: ${actualCurrentLevel} === "underfitting" ? ${count} === 50 : ${count} >= ${currentLevelConfig.minDataPoints}`)

    // Special debug for levels 2-3
    if (actualCurrentLevel === "underfitting" || actualCurrentLevel === "overfitting") {
      console.log(`[DataCount] DEBUG ${actualCurrentLevel}: count=${count}, isDataSufficient=${isDataSufficient}, alreadyAchieved=${alreadyAchieved}, animationTriggered=${animationAlreadyTriggered}`)
    }

    if (isDataSufficient && !alreadyAchieved && !animationAlreadyTriggered) {
      console.log(`[CoinAnimation] Triggering coin animation for ${actualCurrentLevel}`)

      // Mark animation as triggered immediately to prevent multiple triggers
      animationTriggeredRef.current[actualCurrentLevel] = true

      setLevelProgress((prev) => {
        const newProgress = {
          ...prev,
          [actualCurrentLevel]: { ...prev[actualCurrentLevel], dataPointsAchieved: true },
        }

        // Calculate new total coins based on updated progress
        const newTotalCoins = Object.values(newProgress).reduce((total, progress) => {
          return (
            total + (progress.dataPointsAchieved ? 5 : 0) + (progress.modelTrained ? 5 : 0) + (progress.aiStarted ? 5 : 0)
          )
        }, 0)

        // Trigger coin animation with correct total
        setTimeout(() => {
          const dataCountElement = document.querySelector("[data-data-counter]")
          console.log(`[CoinAnimation] Data counter element found: ${!!dataCountElement}`)
          if (dataCountElement) {
            triggerCoinAnimation(dataCountElement as HTMLElement)
          }
          animateCoinsIncrement(newTotalCoins)
        }, 0)

        return newProgress
      })
      console.log(`[v0] Earned 5 coins for meeting data points requirement in ${actualCurrentLevel}`)
    }
  }

  const handleGameStateChange = (state: GameState) => {
    setGameState(state)
  }

  const handleHighScoreUpdate = (newHighScore: number) => {
    setHighScore(newHighScore)
  }

  const handleTrainingStatusUpdate = (status: string) => {
    setTrainingStatus(status)
  }

  const handleLevelChange = (level: Level) => {
    const requiredCoins = level === "underfitting" ? 15 : level === "overfitting" ? 30 : 0
    console.log(`[LevelSwitch] Attempting to switch to ${level}, required coins: ${requiredCoins}, current coins: ${coins}`)

    if (coins < requiredCoins) {
      console.log(`[LevelSwitch] Insufficient coins for ${level}`)
      alert(`You need ${requiredCoins} coins to unlock ${levelData[level].title}. You have ${coins} coins.`)
      return
    }

    console.log(`[LevelSwitch] Switching to ${level}`)
    console.log(`[LevelSwitch] Current visitedLevels:`, Array.from(visitedLevels))
    setCurrentLevel(level)

    // Only show kickoff for levels that haven't been visited before
    const hasVisitedBefore = visitedLevels.has(level)
    console.log(`[LevelSwitch] hasVisitedBefore ${level}:`, hasVisitedBefore)
    setIsKickoff(!hasVisitedBefore)

    // Add level to visited levels if it's the first time
    if (!hasVisitedBefore) {
      console.log(`[LevelSwitch] Adding ${level} to visited levels`)
      setVisitedLevels(prev => new Set([...prev, level]))
    }

    const instructionsPanel = document.querySelector("[data-instructions-panel]")
    if (instructionsPanel) {
      instructionsPanel.scrollTop = 0
    }

    if (gameEngine) {
      gameEngine.clearDataset()
      gameEngine.setLevel(level)
      gameEngine.restart()
      setDataCount(0)
      setScore(0)
      setIsAI(false)
      setIsRecording(false)
      // Only reset animation trigger if achievement hasn't been completed yet
      // This prevents re-triggering animations for already earned achievements
      if (!levelProgress[level].dataPointsAchieved) {
        animationTriggeredRef.current[level] = false
        console.log(`[v0] Reset animation trigger for ${level} (achievement not yet earned)`)
      } else {
        console.log(`[v0] Keeping animation trigger for ${level} (achievement already earned)`)
      }
      console.log(`[v0] Cleared all data and model when switching to ${level}`)
    }
  }

  const handleAIStart = (buttonElement?: HTMLElement) => {
    if (!levelProgress[currentLevel].aiStarted) {
      setLevelProgress((prev) => {
        const newProgress = {
          ...prev,
          [currentLevel]: { ...prev[currentLevel], aiStarted: true },
        }

        // Calculate new total coins based on updated progress
        const newTotalCoins = Object.values(newProgress).reduce((total, progress) => {
          return (
            total + (progress.dataPointsAchieved ? 5 : 0) + (progress.modelTrained ? 5 : 0) + (progress.aiStarted ? 5 : 0)
          )
        }, 0)

        // Trigger coin animation with correct total
        setTimeout(() => {
          if (buttonElement) {
            triggerCoinAnimation(buttonElement)
          }
          animateCoinsIncrement(newTotalCoins)
        }, 0)

        return newProgress
      })
      console.log(`[v0] Earned 5 coins for starting AI in ${currentLevel}`)
    }
  }

  const handleContinueFromKickoff = () => {
    setIsKickoff(false)
    // Don't mark guidance as completed - let it show during first-time play
    console.log(`[Guidance] Continuing from kickoff for ${currentLevel} - guidance will now be available`)
  }

  const handleDismissGuidance = () => {
    setShowGuidance(false)
    // Mark guidance as completed for current level instead of global dismissal
    setGuidanceCompletedLevels(prev => new Set([...prev, currentLevel]))
  }

  const handleDismissChatHint = () => {
    setShowChatHint(false)
    if (typeof window !== "undefined") {
      localStorage.setItem("flappyml-chat-hint-dismissed", "true")
    }
  }

  const handleChatOpen = () => {
    setIsChatOpen(true)
    // Dismiss chat hint when user discovers and opens chat
    if (showChatHint) {
      handleDismissChatHint()
    }
    if (gameEngine) {
      gameEngine.pause()
    }
  }

  const handleChatClose = () => {
    setIsChatOpen(false)
    if (gameEngine) {
      gameEngine.resume()
    }
  }

  const getGameContext = (): GameContext => {
    const currentLevelConfig = levelData[currentLevel]
    const coinsNeeded = currentLevel === "underfitting" ? 15 : currentLevel === "overfitting" ? 30 : 0

    return {
      currentLevel,
      currentStep,
      levelProgress,
      gameState,
      score,
      coins,
      dataCount,
      dataRequirement: {
        min: currentLevelConfig.minDataPoints,
        max: currentLevelConfig.maxDataPoints,
        timeRequired: `${Math.floor(currentLevelConfig.minDataPoints / 10)} seconds`
      },
      isRecording,
      isAI,
      trainingStatus,
      showGuidance,
      guidanceText: getGuidanceText(),
      unlockedLevels: (Object.keys(levelData) as Level[]).filter(level =>
        level === "finetuning" || (level === "underfitting" && coins >= 15) || (level === "overfitting" && coins >= 30)
      )
    }
  }

  const getGuidanceText = () => {
    switch (currentStep) {
      case 1:
        return "Press Start Recording when you're ready to start recording your gameplay"
      case 2:
        return "Keep playing for 45 secs to collect enough training data"
      case 3:
        return "Now train the AI model with your recorded gameplay"
      case 4:
        return "AI learns from you gameplay and will perform better! Start the AI after training."
      case 5:
        return "Now you can see how the AI calculates the path and determines the next move automously!"
      default:
        return ""
    }
  }

  const getGuidanceTarget = () => {
    switch (currentStep) {
      case 1:
      case 2:
        return "recording"
      case 3:
        return "training"
      case 4:
        return "ai"
      default:
        return ""
    }
  }

  useEffect(() => {
    if (gameEngine) {
      const checkStatus = () => {
        const wasAI = isAI
        const newIsAI = gameEngine.isAI

        setIsRecording(gameEngine.isRecording)
        setIsAI(newIsAI)

        if (!wasAI && newIsAI) {
          handleAIStart()
        }
      }

      const interval = setInterval(checkStatus, 100)
      return () => clearInterval(interval)
    }
  }, [gameEngine, isAI, currentLevel, levelProgress])

  const currentLevelConfig = levelData[currentLevel]
  const LevelIcon = currentLevelConfig.icon

  const isLevelUnlocked = (level: Level) => {
    if (level === "finetuning") return true
    if (level === "underfitting") return coins >= 15
    if (level === "overfitting") return coins >= 30
    return false
  }

  const getTotalCoinsNeeded = (level: Level) => {
    if (level === "underfitting") return 15
    if (level === "overfitting") return 30
    return 0
  }

  const [animatingCoins, setAnimatingCoins] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [coinCountAnimation, setCoinCountAnimation] = useState<{
    target: number
    current: number
    isAnimating: boolean
  }>({
    target: 0,
    current: 0,
    isAnimating: false,
  })

  const triggerCoinAnimation = (buttonElement: HTMLElement) => {
    const rect = buttonElement.getBoundingClientRect()
    const baseId = Date.now()
    const newCoins = Array.from({ length: 3 }, (_, i) => ({
      id: baseId + i * 1000 + Math.random() * 100, // Ensure unique IDs
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }))

    setAnimatingCoins((prev) => [...prev, ...newCoins])

    setTimeout(() => {
      setAnimatingCoins((prev) => prev.filter((coin) => !newCoins.some((newCoin) => newCoin.id === coin.id)))
    }, 1000)
  }

  const animateCoinsIncrement = (newTotal: number) => {
    setCoinCountAnimation({
      target: newTotal,
      current: coins,
      isAnimating: true,
    })
  }

  useEffect(() => {
    if (coinCountAnimation.isAnimating && coinCountAnimation.current < coinCountAnimation.target) {
      const timer = setTimeout(() => {
        setCoinCountAnimation((prev) => ({
          ...prev,
          current: prev.current + 1,
        }))
      }, 100)
      return () => clearTimeout(timer)
    } else if (coinCountAnimation.current >= coinCountAnimation.target && coinCountAnimation.isAnimating) {
      setCoinCountAnimation((prev) => ({ ...prev, isAnimating: false }))
      setCoins(coinCountAnimation.target)
    }
  }, [coinCountAnimation])

  const handleTrainModelClick = (buttonElement: HTMLElement) => {
    if (!levelProgress[currentLevel].modelTrained) {
      setLevelProgress((prev) => {
        const newProgress = {
          ...prev,
          [currentLevel]: { ...prev[currentLevel], modelTrained: true },
        }

        if (!prev[currentLevel].dataPointsAchieved) {
          const currentLevelConfig = levelData[currentLevel]
          const isDataSufficient =
            currentLevel === "underfitting" ? dataCount === 50 : dataCount >= currentLevelConfig.minDataPoints

          if (isDataSufficient) {
            newProgress[currentLevel].dataPointsAchieved = true
            console.log(`[v0] Auto-achieved datapoints for ${currentLevel} as fallback`)
          }
        }

        // Calculate new total coins based on updated progress
        const newTotalCoins = Object.values(newProgress).reduce((total, progress) => {
          return (
            total + (progress.dataPointsAchieved ? 5 : 0) + (progress.modelTrained ? 5 : 0) + (progress.aiStarted ? 5 : 0)
          )
        }, 0)

        // Trigger coin animations with correct total
        setTimeout(() => {
          if (!prev[currentLevel].dataPointsAchieved && newProgress[currentLevel].dataPointsAchieved) {
            // Both data points and model training achieved
            const dataCountElement = document.querySelector("[data-data-counter]")
            if (dataCountElement) {
              triggerCoinAnimation(dataCountElement as HTMLElement)
            }
            setTimeout(() => {
              triggerCoinAnimation(buttonElement)
              animateCoinsIncrement(newTotalCoins)
            }, 100)
          } else {
            // Only model training achieved
            triggerCoinAnimation(buttonElement)
            animateCoinsIncrement(newTotalCoins)
          }
        }, 0)

        return newProgress
      })
      console.log(`[v0] Earned 5 coins for training model in ${currentLevel}`)
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="fixed inset-0 pointer-events-none z-50">
        {animatingCoins.map((coin) => (
          <div
            key={coin.id}
            className="absolute text-2xl"
            style={{
              left: coin.x,
              top: coin.y,
              animation: `coinFly 1s ease-out forwards`,
            }}
          >
            <CoinIcon size={24} />
          </div>
        ))}
      </div>

      <header
        className={`border-b border-border bg-card/50 backdrop-blur-sm transition-opacity duration-300 ${isKickoff || isChatOpen ? "opacity-30 pointer-events-none" : "opacity-100"}`}
      >
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-3">
              <div className="flex items-center gap-1 sm:gap-2">
                <Gamepad2 className="h-4 w-4 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-secondary" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-foreground">
                  Flight Coach AI
                </h1>
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground">Machine Learning Training Game</p>
              </div>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="p-1 sm:p-2 lg:p-3">
                <div className="text-center">
                  <div className="text-sm sm:text-xl lg:text-2xl xl:text-3xl font-bold font-mono text-foreground flex items-center justify-center gap-1">
                    <CoinIcon size={20} className="sm:w-6 sm:h-6 lg:w-8 lg:h-8" />
                    {coinCountAnimation.isAnimating ? coinCountAnimation.current : coins}
                  </div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground">Gold Coins</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex gap-1 sm:gap-2 flex-1">
              {(Object.keys(levelData) as Level[]).map((level) => {
                const config = levelData[level]
                const Icon = config.icon
                const isActive = level === currentLevel
                const unlocked = isLevelUnlocked(level)
                const coinsNeeded = getTotalCoinsNeeded(level)

                return (
                  <Button
                    key={level}
                    onClick={() => handleLevelChange(level)}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    disabled={!unlocked && currentLevel === "finetuning"}
                    className={`flex-1 text-[10px] sm:text-xs relative ${!unlocked ? "opacity-50" : ""}`}
                    title={!unlocked ? `Need ${coinsNeeded} coins to unlock` : ""}
                  >
                    <Icon className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                    <span className="hidden sm:inline">{config.title}</span>
                    <span className="sm:hidden">
                      {level === "finetuning" ? "L1" : level === "underfitting" ? "L2" : "L3"}
                    </span>
                    {!unlocked && coinsNeeded > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[8px] px-1 rounded-full font-bold">
                        {coinsNeeded}
                      </span>
                    )}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4 lg:py-6">
        <div className="flex items-start justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-6">
          <div className="w-[30%] flex-shrink-0">
            <Card
              className={`w-full bg-muted/50 border-border h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px] xl:h-[600px] transition-all duration-300 ${
                isKickoff ? "ring-1 ring-black shadow-xl" : ""
              } ${isChatOpen ? "opacity-30" : ""}`}
            >
              <CardHeader className="pb-1 sm:pb-2 lg:pb-3">
                <CardTitle className="text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg flex items-center gap-1 sm:gap-2">
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                  Instructions
                </CardTitle>
                <CardDescription className="text-[8px] sm:text-[10px] md:text-xs lg:text-sm">
                  {currentLevelConfig.description}
                </CardDescription>
              </CardHeader>
              <CardContent
                data-instructions-panel
                className={`space-y-1 sm:space-y-2 lg:space-y-3 overflow-y-auto max-h-[320px] sm:max-h-[370px] md:max-h-[420px] lg:max-h-[470px] xl:max-h-[520px] text-[8px] sm:text-[10px] md:text-xs lg:text-sm transition-all duration-300 ${
                  isKickoff ? "pt-2 sm:pt-3 lg:pt-4" : ""
                }`}
              >
                <div className="space-y-3 lg:space-y-4">
                  <div
                    className={`p-2 lg:p-3 ${currentLevelConfig.bgColor} rounded-lg border ${currentLevelConfig.borderColor} transition-all duration-300 ${
                      isKickoff ? "ring-1 ring-black shadow-xl z-10 relative" : ""
                    }`}
                  >
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <currentLevelConfig.icon className={`h-3 w-3 lg:h-4 lg:w-4 ${currentLevelConfig.color}`} />
                      {currentLevelConfig.title}
                    </h4>
                    <p className="text-xs lg:text-sm text-muted-foreground mb-2">{currentLevelConfig.description}</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {currentLevelConfig.instructions.map((instruction, index) => (
                        <li key={index}>• {instruction}</li>
                      ))}
                    </ul>
                  </div>

                  <div
                    className={`p-2 lg:p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 transition-all duration-300 ${
                      isKickoff ? "ring-1 ring-black shadow-xl z-10 relative" : ""
                    }`}
                  >
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Brain className="h-3 w-3 lg:h-4 lg:w-4 text-blue-600" />
                      Learning Process
                    </h4>
                    <p className="text-xs lg:text-sm text-muted-foreground mb-2">
                      {currentLevel === "finetuning" && "How AI learns when given plenty of examples"}
                      {currentLevel === "underfitting" && "What happens when AI gets too few examples"}
                      {currentLevel === "overfitting" && "When AI memorizes instead of truly learning"}
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {currentLevel === "finetuning" && (
                        <>
                          <li>• AI studies your 45+ seconds of gameplay examples</li>
                          <li>• Learns when to jump in many different situations</li>
                          <li>• Gets enough practice to build real understanding</li>
                          <li>• Becomes skilled at handling new challenges</li>
                        </>
                      )}
                      {currentLevel === "underfitting" && (
                        <>
                          <li>• Only 5 seconds gives AI very few examples to study</li>
                          <li>• Not enough practice to learn proper timing</li>
                          <li>• Like learning basketball from watching one shot!</li>
                          <li>• AI makes mostly random, unskilled moves</li>
                        </>
                      )}
                      {currentLevel === "overfitting" && (
                        <>
                          <li>• AI sees only identical pipe patterns during training</li>
                          <li>• Memorizes exact timing for these specific patterns</li>
                          <li>• Fails when pipes are in different positions</li>
                          <li>• Like memorizing one math problem instead of learning math!</li>
                        </>
                      )}
                    </ul>
                  </div>

                  <div
                    className={`p-2 lg:p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800 transition-all duration-300 ${
                      isKickoff ? "opacity-30 pointer-events-none" : ""
                    }`}
                  >
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="h-3 w-3 lg:h-4 lg:w-4 text-purple-600 inline-flex items-center justify-center font-mono font-bold">&lt;/&gt;</span>
                      Details for Nerds
                    </h4>
                    <div className="text-xs lg:text-sm text-muted-foreground mb-2">
                      <strong className="text-purple-700 dark:text-purple-300 capitalize">
                        {currentLevel === "finetuning" ? "Fine-tuning" : currentLevel === "underfitting" ? "Underfitting" : "Overfitting"}:
                      </strong>
                      <span className="ml-1">
                        {currentLevel === "finetuning" && "Training with optimal data amount and additional expert examples"}
                        {currentLevel === "underfitting" && "Training with insufficient data, leading to poor model performance"}
                        {currentLevel === "overfitting" && "Training on repetitive patterns, causing poor generalization"}
                      </span>
                    </div>
                    <p className="text-xs lg:text-sm text-muted-foreground mb-2">
                      The AI learns from these game features:
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ball's vertical position & velocity</li>
                      <li>• Distance to next pipe</li>
                      <li>• Length of next pipe</li>
                      <li>• Timing since last jump</li>
                    </ul>
                  </div>

                  {isKickoff && (
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={handleContinueFromKickoff}
                        className="px-6 py-3 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
                      >
                        Continue to Game
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div
            className={`w-[40%] flex-shrink-0 transition-opacity duration-300 ${isKickoff ? "opacity-30 pointer-events-none" : "opacity-100"}`}
          >
            <GameCanvas
              onGameEngineReady={handleGameEngineReady}
              onScoreUpdate={handleScoreUpdate}
              onDataCountUpdate={handleDataCountUpdate}
              onGameStateChange={handleGameStateChange}
              onTrainingStatusUpdate={handleTrainingStatusUpdate}
              onHighScoreUpdate={handleHighScoreUpdate}
              currentScore={score}
              currentLevel={currentLevel}
              isPaused={isChatOpen}
            />
          </div>

          <div
            className={`w-[30%] flex-shrink-0 transition-opacity duration-300 ${isKickoff || isChatOpen ? "opacity-30 pointer-events-none" : "opacity-100"}`}
          >
            <ControlPanel
              gameEngine={gameEngine}
              dataCount={dataCount}
              trainingStatus={trainingStatus}
              isRecording={isRecording}
              isAI={isAI}
              currentLevel={currentLevel}
              levelProgress={levelProgress}
              onTrainModelClick={handleTrainModelClick}
              onAIStartClick={handleAIStart}
              guidanceTarget={showGuidance ? getGuidanceTarget() : ""}
              showGuidance={showGuidance}
              guidanceText={getGuidanceText()}
              currentStep={currentStep}
              onDismissGuidance={handleDismissGuidance}
            />
          </div>
        </div>

      </main>

      {/* AI Chat System */}
      <ChatButton
        isOpen={isChatOpen}
        onClick={() => isChatOpen ? handleChatClose() : handleChatOpen()}
      />

      {/* Chat Discovery Hint */}
      {isClient && showChatHint && showGuidance && (currentStep === 1 || currentStep === 2) && !isChatOpen && (
        <div className="fixed bottom-16 right-6 z-50 max-w-64 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg relative">
            <button
              onClick={handleDismissChatHint}
              className="absolute -top-1 -right-1 bg-blue-700 hover:bg-blue-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold transition-colors"
            >
              ×
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                💬
              </div>
              <div className="text-sm font-medium">
                Need help? Ask me anything!
              </div>
            </div>
            <div className="text-xs opacity-90 mt-1">
              I can explain AI concepts, help with the game, and answer your questions.
            </div>
            {/* Arrow pointing to chat button */}
            <div className="absolute -bottom-2 right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-blue-600"></div>
          </div>
        </div>
      )}

      <ChatModal
        isOpen={isChatOpen}
        onClose={handleChatClose}
        getGameContext={getGameContext}
      />

      <style jsx global>{`
        @keyframes coinFly {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(-10px, -50px) scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: translate(0, -100vh) scale(0.8);
            opacity: 0;
          }
        }

        @keyframes gradient-x {
          0%, 100% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
          }
        }

        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
