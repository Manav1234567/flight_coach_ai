"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Play, Pause, Trash2, Download, Upload, Brain, Bot, X } from "lucide-react"
import type { GameEngine } from "@/lib/game-engine"
import type { Level } from "@/app/page"
import { CoinIcon } from "@/components/ui/coin-icon"

interface ControlPanelProps {
  gameEngine: GameEngine | null
  dataCount: number
  trainingStatus: string
  isRecording: boolean
  isAI: boolean
  currentLevel: Level
  levelProgress: Record<Level, { dataPointsAchieved: boolean; modelTrained: boolean; aiStarted: boolean }>
  onTrainModelClick: (buttonElement: HTMLElement) => void
  onAIStartClick: (buttonElement: HTMLElement) => void
  guidanceTarget?: string
  showGuidance?: boolean
  guidanceText?: string
  currentStep?: number
  onDismissGuidance?: () => void
}

const levelRequirements = {
  finetuning: { min: 450, max: null },
  underfitting: { min: 50, max: 50 },
  overfitting: { min: 200, max: null },
}

export function ControlPanel({
  gameEngine,
  dataCount,
  trainingStatus,
  isRecording,
  isAI,
  currentLevel,
  levelProgress,
  onTrainModelClick,
  onAIStartClick,
  guidanceTarget = "",
  showGuidance = false,
  guidanceText = "",
  currentStep = 1,
  onDismissGuidance,
}: ControlPanelProps) {
  const [isTraining, setIsTraining] = useState(false)
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused">("idle")
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState("")
  const [showProgress, setShowProgress] = useState(false)
  const [isDeveloperMode, setIsDeveloperMode] = useState(false)
  const [completionMessage, setCompletionMessage] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        event.preventDefault()
        setIsDeveloperMode((prev) => !prev)
        console.log("[v0] Developer mode toggled:", !isDeveloperMode)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isDeveloperMode])

  useEffect(() => {
    setRecordingState("idle")
    gameEngine?.pauseRecording() // Stop any active recording
    console.log("[v0] Recording state reset to idle and recording stopped due to level change")
  }, [currentLevel, gameEngine])

  const handleStartRecording = () => {
    if (recordingState === "idle") {
      gameEngine?.startRecording()
      setRecordingState("recording") // Immediately set to recording state
    } else if (recordingState === "paused") {
      gameEngine?.resumeRecording()
      setRecordingState("recording")
    }
  }

  const handlePauseRecording = () => {
    if (recordingState === "recording") {
      gameEngine?.pauseRecording()
      setRecordingState("paused")
    } else if (recordingState === "paused") {
      gameEngine?.resumeRecording()
      setRecordingState("recording")
    }
  }

  const handleClearDataset = () => {
    if (confirm("Restart the entire game? This will clear all data and reset everything.")) {
      gameEngine?.restart()
      setRecordingState("idle")
      setShowProgress(false)
      setProgress(0)
      setProgressText("")
    }
  }

  const handleDownloadCSV = () => {
    gameEngine?.downloadCSV()
  }

  const handleUploadCSV = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && gameEngine) {
      try {
        await gameEngine.uploadCSV(file)
      } catch (error) {
        console.error("Upload failed:", error)
      }
    }
    // Reset input
    event.target.value = ""
  }

  const handleTrainModel = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const minRequired = levelRequirements[currentLevel].min
    if (!gameEngine || gameEngine.dataset.length < minRequired) {
      const timeRequired = getTimeRequirement(currentLevel)
      alert(`Need at least ${timeRequired} of gameplay recording to train effectively for this level!`)
      return
    }

    onTrainModelClick(event.currentTarget)

    if (recordingState === "recording") {
      gameEngine.pauseRecording()
      setRecordingState("paused")
    }

    setIsTraining(true)
    setShowProgress(true)
    setProgress(10)
    setProgressText("Preparing dataset...")
    setCompletionMessage("")

    gameEngine.onProgressUpdate = (percent: number, text: string) => {
      setProgress(percent)
      setProgressText(text)
    }

    gameEngine.onStatusUpdate = (message: string) => {
      setCompletionMessage(message)
    }

    try {
      await gameEngine.trainModel()
      setTimeout(() => {
        setShowProgress(false)
      }, 2000)
    } catch (error) {
      console.error("Training failed:", error)
      alert("Training failed: " + (error as Error).message)
      setShowProgress(false)
    } finally {
      setIsTraining(false)
    }
  }

  const handleToggleAI = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isAI) {
      gameEngine?.stopAI()
    } else {
      onAIStartClick(event.currentTarget)

      if (recordingState === "recording") {
        gameEngine?.pauseRecording()
        setRecordingState("paused")
      }
      gameEngine?.startAI()
    }
  }

  const requirements = levelRequirements[currentLevel]
  const isDataSufficient =
    currentLevel === "underfitting"
      ? dataCount === 50 // Exactly 50 for underfitting
      : dataCount >= requirements.min
  const progressPercentage = Math.min((dataCount / requirements.min) * 100, 100)
  const isMaxReached = requirements.max && dataCount >= requirements.max

  const formatDataCountAsTime = (count: number) => {
    const seconds = Math.floor(count / 10) // Since data points increment every 100ms, divide by 10 to get seconds
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const getTimeRequirement = (level: Level) => {
    const points = levelRequirements[level].min
    const seconds = Math.floor(points / 10)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const shouldShowStartRecording = recordingState === "idle"

  return (
    <div className="w-full space-y-1 sm:space-y-2 lg:space-y-3">
      <Card className="bg-card border-border h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px] xl:h-[600px] flex flex-col">
        <CardHeader className="pb-1 sm:pb-2 lg:pb-3">
          <CardTitle className="text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg font-bold text-card-foreground flex items-center gap-1 sm:gap-2">
            <Brain className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 xl:h-6 xl:w-6" />
            Game Controls
          </CardTitle>
          {showGuidance ? (
            <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 text-white border-2 border-blue-400 rounded-lg p-2 sm:p-3 shadow-lg animate-pulse-slow overflow-hidden">
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-gradient-x"></div>

              {/* Content */}
              <div className="relative flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-shrink-0">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white text-blue-600 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-sm animate-bounce-subtle">
                      {currentStep}
                    </div>
                  </div>
                  <div className="text-[10px] sm:text-xs font-medium drop-shadow-sm">
                    {guidanceText}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <CardDescription className="text-[8px] sm:text-[10px] md:text-xs lg:text-sm">
              Record gameplay to train AI Model
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-1 sm:space-y-2 lg:space-y-3 flex-1 text-[8px] sm:text-[10px] md:text-xs lg:text-sm overflow-y-auto">
          <div className="space-y-1 sm:space-y-2 p-1 sm:p-2 lg:p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 lg:mb-3">
              <CoinIcon size={16} className="sm:w-5 sm:h-5" />
              <span className="text-[9px] sm:text-[11px] md:text-xs font-semibold text-foreground">
                {currentLevel === "finetuning" ? "Level 1" : currentLevel === "underfitting" ? "Level 2" : "Level 3"}{" "}
                Coin Progress
              </span>
            </div>
            <div className="space-y-1 text-[8px] sm:text-[10px] md:text-xs">
              <div className="flex justify-between items-center">
                <span>
                  {currentLevel === "finetuning"
                    ? "Record at least 45 sec:"
                    : currentLevel === "underfitting"
                      ? "Record exactly 5 sec:"
                      : "Record at least 20 sec:"}
                </span>
                <span
                  className={`font-bold ${levelProgress[currentLevel].dataPointsAchieved ? "text-green-600" : "text-muted-foreground"}`}
                >
                  {levelProgress[currentLevel].dataPointsAchieved ? "✓ 5 coins" : "5 coins"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Train Model:</span>
                <span
                  className={`font-bold ${levelProgress[currentLevel].modelTrained ? "text-green-600" : "text-muted-foreground"}`}
                >
                  {levelProgress[currentLevel].modelTrained ? "✓ 5 coins" : "5 coins"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Start AI:</span>
                <span
                  className={`font-bold ${levelProgress[currentLevel].aiStarted ? "text-green-600" : "text-muted-foreground"}`}
                >
                  {levelProgress[currentLevel].aiStarted ? "✓ 5 coins" : "5 coins"}
                </span>
              </div>
            </div>
          </div>

          <div className={`space-y-1 sm:space-y-2 p-1 sm:p-2 lg:p-3 bg-muted/30 rounded-lg border transition-all duration-300 ${
            guidanceTarget === "recording" ? "ring-2 ring-blue-500 ring-opacity-75 shadow-lg" : ""
          }`}>
            <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 lg:mb-3">
              <div className="h-2 w-2 sm:h-3 sm:w-3 lg:h-4 lg:w-4 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[9px] sm:text-[11px] md:text-xs font-semibold text-foreground">
                Record Gameplay
              </span>
            </div>

            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] sm:text-[10px] md:text-xs text-muted-foreground">Gameplay Time:</span>
                <Badge
                  data-data-counter
                  variant={isDataSufficient ? "default" : "destructive"}
                  className={`font-mono text-[8px] sm:text-[10px] md:text-xs px-1 sm:px-2 py-0.5 ${
                    isDataSufficient ? "bg-green-600 text-white" : ""
                  }`}
                >
                  {formatDataCountAsTime(dataCount)} 
                </Badge>
              </div>

              <div className="space-y-1">
                <Progress
                  value={progressPercentage}
                  className={`w-full h-1 sm:h-2 ${isDataSufficient ? "bg-green-100" : "bg-red-100"}`}
                />
                <div className="text-[7px] sm:text-[9px] text-center text-muted-foreground">
                  {isMaxReached
                    ? "Maximum reached!"
                    : isDataSufficient
                      ? currentLevel === "finetuning"
                        ? "Great! More data is always better"
                        : "Ready to train!"
                      : `Need ${currentLevel === "underfitting" ? "exactly" : "at least"} ${Math.floor(levelRequirements[currentLevel].min / 10)} seconds`}
                </div>
              </div>
            </div>

            <div className="flex gap-0.5 sm:gap-1">
              {shouldShowStartRecording ? (
                <Button
                  onClick={handleStartRecording}
                  variant="default"
                  size="sm"
                  className={`flex-1 text-[8px] sm:text-[10px] md:text-xs py-1 sm:py-2 h-5 sm:h-6 md:h-7 lg:h-8 min-w-0 transition-all duration-300 ${
                    guidanceTarget === "recording" ? "animate-pulse" : ""
                  }`}
                  disabled={isMaxReached}
                >
                  <Play className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 flex-shrink-0" />
                  <span className="truncate">
                    <span className="hidden sm:inline">Start </span>Recording
                  </span>
                </Button>
              ) : (
                <Button
                  onClick={handlePauseRecording}
                  variant="default"
                  size="sm"
                  className="flex-1 text-[8px] sm:text-[10px] md:text-xs py-1 sm:py-2 h-5 sm:h-6 md:h-7 lg:h-8 min-w-0"
                  disabled={isMaxReached}
                >
                  {recordingState === "recording" ? (
                    <>
                      <Pause className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 flex-shrink-0" />
                      <span className="truncate">Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 flex-shrink-0" />
                      <span className="truncate">Resume</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            <Button
              onClick={handleClearDataset}
              variant="destructive"
              size="sm"
              className="w-full text-[8px] sm:text-[10px] md:text-xs py-1 sm:py-2 h-5 sm:h-6 md:h-7 lg:h-8 min-w-0"
            >
              <Trash2 className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 flex-shrink-0" />
              <span className="truncate">Restart</span>
            </Button>
          </div>

          <div className={`space-y-1 sm:space-y-2 p-1 sm:p-2 lg:p-3 bg-primary/5 rounded-lg border border-primary/20 transition-all duration-300 ${
            guidanceTarget === "training" || guidanceTarget === "ai" ? "ring-2 ring-blue-500 ring-opacity-75 shadow-lg" : ""
          }`}>
            <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 lg:mb-3">
              <Bot className="h-2 w-2 sm:h-3 sm:w-3 lg:h-4 lg:w-4 text-primary" />
              <span className="text-[9px] sm:text-[11px] md:text-xs lg:text-sm font-semibold text-black dark:text-white">
                AI Controls
              </span>
            </div>

            <Button
              onClick={handleTrainModel}
              disabled={isTraining || !isDataSufficient}
              className={`w-full text-[8px] sm:text-[10px] md:text-xs py-1 sm:py-2 h-5 sm:h-6 md:h-7 lg:h-8 min-w-0 transition-all duration-300 ${
                guidanceTarget === "training" ? "animate-pulse" : ""
              }`}
              variant="secondary"
            >
              <Brain className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 flex-shrink-0" />
              <span className="truncate">{isTraining ? "Training..." : "Train Model"}</span>
            </Button>

            {showProgress && (
              <div className="space-y-1">
                <Progress value={progress} className="w-full h-1 sm:h-2" />
                <div className="text-[7px] sm:text-[9px] md:text-[10px] text-muted-foreground text-center font-mono truncate">
                  {progressText}
                </div>
              </div>
            )}

            <Button
              onClick={handleToggleAI}
              disabled={!gameEngine?.model}
              variant={isAI ? "outline" : "default"}
              className={`w-full text-[8px] sm:text-[10px] md:text-xs py-1 sm:py-2 h-5 sm:h-6 md:h-7 lg:h-8 min-w-0 transition-all duration-300 ${
                guidanceTarget === "ai" ? "animate-pulse" : ""
              }`}
            >
              <Bot className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 flex-shrink-0" />
              <span className="truncate">{isAI ? "🤖 Stop AI" : "🤖 Start AI"}</span>
            </Button>

            {completionMessage && (
              <div className="text-[7px] sm:text-[9px] md:text-[10px] text-center text-muted-foreground bg-muted/50 rounded p-1 sm:p-2">
                {completionMessage}
              </div>
            )}
          </div>

          {isDeveloperMode && (
            <div className="space-y-1 sm:space-y-2 p-1 sm:p-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-1 sm:gap-2 mb-1">
                <Download className="h-2 w-2 sm:h-3 sm:w-3 text-orange-600" />
                <span className="text-[8px] sm:text-[10px] md:text-xs font-semibold text-orange-800 dark:text-orange-200">
                  Dev Tools
                </span>
                <Badge variant="outline" className="text-[7px] sm:text-[9px] md:text-[10px] px-1">
                  Ctrl+Shift+D
                </Badge>
              </div>

              <div className="flex gap-0.5 sm:gap-1">
                <Button
                  onClick={handleDownloadCSV}
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent text-[7px] sm:text-[9px] md:text-[10px] py-0.5 sm:py-1 h-4 sm:h-5 md:h-6 min-w-0"
                  disabled={dataCount === 0}
                >
                  <Download className="h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 mr-0.5" />
                  <span className="truncate">Download</span>
                </Button>
                <Button
                  onClick={handleUploadCSV}
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent text-[7px] sm:text-[9px] md:text-[10px] py-0.5 sm:py-1 h-4 sm:h-5 md:h-6 min-w-0"
                >
                  <Upload className="h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 mr-0.5" />
                  <span className="truncate">Upload</span>
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
