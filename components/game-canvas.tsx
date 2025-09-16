"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { GameEngine, type GameState } from "@/lib/game-engine"
import { Play } from "lucide-react"
import type { Level } from "@/app/page"

interface GameCanvasProps {
  onGameEngineReady: (engine: GameEngine) => void
  onScoreUpdate: (score: number) => void
  onDataCountUpdate: (count: number) => void
  onGameStateChange: (state: GameState) => void
  onTrainingStatusUpdate: (status: string) => void
  onHighScoreUpdate: (highScore: number) => void
  currentScore: number
  currentLevel: Level
}

export function GameCanvas({
  onGameEngineReady,
  onScoreUpdate,
  onDataCountUpdate,
  onGameStateChange,
  onTrainingStatusUpdate,
  onHighScoreUpdate,
  currentScore,
  currentLevel,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameEngineRef = useRef<GameEngine | null>(null)
  const [score, setScore] = useState(0)
  const [gameState, setGameState] = useState<GameState>("menu")
  const [showGameOverTransition, setShowGameOverTransition] = useState(false)

  useEffect(() => {
    if (canvasRef.current && !gameEngineRef.current) {
      const engine = new GameEngine(canvasRef.current)

      // Set up callbacks
      engine.onScoreUpdate = (newScore) => {
        setScore(newScore)
        onScoreUpdate(newScore)
      }

      engine.onDataCountUpdate = onDataCountUpdate

      engine.onGameStateChange = (state) => {
        setGameState(state)
        onGameStateChange(state)

        if (state === "dead") {
          setShowGameOverTransition(true)
          // Reset transition after delay
          setTimeout(() => setShowGameOverTransition(false), 1200)
        }
      }

      engine.onTrainingStatusUpdate = onTrainingStatusUpdate

      engine.onHighScoreUpdate = onHighScoreUpdate

      gameEngineRef.current = engine
      onGameEngineReady(engine)
    }
  }, [
    onGameEngineReady,
    onScoreUpdate,
    onDataCountUpdate,
    onGameStateChange,
    onTrainingStatusUpdate,
    onHighScoreUpdate,
  ])

  const handlePlayClick = () => {
    gameEngineRef.current?.startGame()
  }

  const handleResetClick = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.state = "menu"
      gameEngineRef.current.bird.reset()
      gameEngineRef.current.pipes = []
      setScore(0)
      onScoreUpdate(0)
      onGameStateChange("menu")
    }
  }

  return (
    <div className="h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px] xl:h-[600px] w-full relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={400}
        height={600}
        className="block bg-gradient-to-b from-cyan-200 to-cyan-100 focus:outline-none rounded-lg border border-border shadow-sm max-w-full max-h-full"
        style={{ aspectRatio: "400/600", width: "auto", height: "100%" }}
        tabIndex={0}
      />

      {gameState === "playing" && (
        <div className="absolute top-2 lg:top-4 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-lg px-2 lg:px-3 py-1 lg:py-2">
          <div className="text-white font-mono text-lg lg:text-xl font-bold">{currentScore}</div>
        </div>
      )}

      {/* Game Overlay */}
      {(gameState === "menu" || gameState === "dead") && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 rounded-lg ${
            showGameOverTransition ? "animate-in fade-in slide-in-from-top-4" : ""
          }`}
        >
          <div
            className={`bg-card/95 backdrop-blur-sm shadow-xl rounded-lg border border-border transition-all duration-300 w-[85%] max-w-[140px] sm:max-w-[160px] md:max-w-[180px] lg:max-w-[200px] xl:max-w-[240px] ${
              showGameOverTransition ? "animate-in zoom-in-95 slide-in-from-top-4" : ""
            }`}
          >
            <div className="p-2 sm:p-3 md:p-4 lg:p-5 text-center space-y-1 sm:space-y-2 md:space-y-3">
              <h2 className="text-[10px] sm:text-xs md:text-sm lg:text-base font-bold text-card-foreground">
                {gameState === "menu" ? "Flight Coach AI" : "Game Over!"}
              </h2>

              {gameState === "dead" && (
                <p className="text-[8px] sm:text-[10px] md:text-xs lg:text-sm text-muted-foreground">
                  Final Score: <span className="font-mono font-bold text-card-foreground">{score}</span>
                </p>
              )}

              <div className="flex justify-center">
                <Button
                  onClick={handlePlayClick}
                  className="px-2 sm:px-3 md:px-4 lg:px-5 text-[8px] sm:text-[10px] md:text-xs lg:text-sm py-1 sm:py-1.5 md:py-2 min-w-0 btn-primary"
                  style={{ backgroundColor: "#164e63", color: "#ffffff" }}
                >
                  <Play className="h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4 mr-1" />
                  <span className="truncate" style={{ color: "#ffffff" }}>
                    {gameState === "menu" ? "Start Game" : "Play Again"}
                  </span>
                </Button>
              </div>

              <p className="text-[7px] sm:text-[8px] md:text-[10px] lg:text-xs text-muted-foreground">
                Press{" "}
                <kbd className="px-0.5 py-0.5 bg-muted text-muted-foreground rounded text-[7px] sm:text-[8px] md:text-[10px]">
                  Space
                </kbd>{" "}
                or{" "}
                <kbd className="px-0.5 py-0.5 bg-muted text-muted-foreground rounded text-[7px] sm:text-[8px] md:text-[10px]">
                  Click
                </kbd>{" "}
                to jump
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
