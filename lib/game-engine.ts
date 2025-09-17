import { MLTrainer } from "./ml-trainer"

export interface Position {
  x: number
  y: number
}

export interface Velocity {
  y: number
}

export class Bird {
  pos: Position
  vel: Velocity
  radius: number
  color: string

  constructor() {
    this.pos = { x: 50, y: 300 }
    this.vel = { y: 0 }
    this.radius = 20
    this.color = "#ffd700" // Default gold color for human player
  }

  reset() {
    this.pos = { x: 50, y: 300 }
    this.vel = { y: 0 }
  }
}

export class Pipe {
  x: number
  width: number
  gapSize: number
  gapCenter: number
  color: string
  passed?: boolean

  constructor(canvasHeight: number, x: number, fixedGapCenter?: number) {
    this.x = x
    this.width = 40
    this.gapSize = 200
    this.gapCenter = fixedGapCenter !== undefined ? fixedGapCenter : Math.random() * (canvasHeight - 300) + 150
    this.color = "#228b22"
  }

  get top() {
    return this.gapCenter - this.gapSize / 2
  }

  get bottom() {
    return this.gapCenter + this.gapSize / 2
  }
}

export interface GameData {
  pressed: number
  y: number
  vel: number
  dist: number
  mid1: number
  mid2: number
}

export interface FeatureStats {
  means: number[]
  stds: number[]
}

export type GameState = "menu" | "playing" | "dead"

export type Level = "finetuning" | "underfitting" | "overfitting"

export class GameEngine {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  bird: Bird
  pipes: Pipe[]
  score: number
  highScore: number // Added high score tracking
  state: GameState
  keys: { [key: string]: boolean }
  gravity: number
  jumpStrength: number
  pipeSpeed: number
  pipeInterval: number
  nextPipeDist: number
  prevSpace: boolean
  isRecording: boolean
  isAI: boolean
  dataset: GameData[]
  model: any // TensorFlow model
  featureStats: FeatureStats | null
  aiPredictionCount: number
  jumpScheduled: boolean
  dataBuffer: GameData | null
  framesSinceLastJump: number
  gameOverTime: number
  gameOverDelay: number
  gameStarted: boolean
  hoverOffset: number // Added for bird vibration effect
  currentLevel: Level
  fixedGapCenter: number
  isPaused: boolean
  pausedState: {
    gameState: GameState
    gameStarted: boolean
    hoverOffset: number
  } | null

  // Callbacks for UI updates
  onScoreUpdate?: (score: number) => void
  onDataCountUpdate?: (count: number) => void
  onGameStateChange?: (state: GameState) => void
  onTrainingStatusUpdate?: (status: string) => void
  onProgressUpdate?: (percent: number, text: string) => void
  onHighScoreUpdate?: (highScore: number) => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get canvas context")
    this.ctx = ctx

    this.bird = new Bird()
    this.pipes = []
    this.score = 0
    this.highScore = 0 // Initialize high score
    this.state = "menu"
    this.keys = {}
    this.gravity = 0.2
    this.jumpStrength = -5
    this.pipeSpeed = 2
    this.pipeInterval = 250
    this.nextPipeDist = 0
    this.prevSpace = false
    this.isRecording = false
    this.isAI = false
    this.dataset = []
    this.model = null
    this.featureStats = null
    this.aiPredictionCount = 0
    this.jumpScheduled = false
    this.dataBuffer = null
    this.framesSinceLastJump = 0
    this.gameOverTime = 0
    this.gameOverDelay = 1000 // 1 second delay
    this.gameStarted = false
    this.hoverOffset = 0
    this.currentLevel = "finetuning"
    this.fixedGapCenter = this.canvas.height / 2
    this.isPaused = false
    this.pausedState = null

    this.setupEventListeners()
    this.setupDataCollection()
    this.startGameLoop()
  }

  setLevel(level: Level) {
    this.currentLevel = level
    this.fixedGapCenter = this.canvas.height / 2 // Reset fixed gap center

    this.isRecording = false
    console.log(`[v0] Level set to: ${level}, recording stopped`)
  }

  private setupEventListeners() {
    this.canvas.tabIndex = 0

    document.addEventListener("keydown", (e) => {
      // Ignore all input when paused
      if (this.isPaused) return

      this.keys[e.key] = true
      if (e.key === " ") {
        e.preventDefault()
        if (
          (this.state === "menu" || (this.state === "dead" && Date.now() - this.gameOverTime > this.gameOverDelay)) &&
          !this.isAI
        ) {
          this.startGame()
        }
      }
    })

    document.addEventListener("keyup", (e) => {
      // Ignore all input when paused
      if (this.isPaused) return

      this.keys[e.key] = false
      if (e.key === " ") {
        e.preventDefault()
        this.prevSpace = false
      }
    })

    this.canvas.addEventListener("click", (e) => {
      e.preventDefault()
      // Ignore all input when paused
      if (this.isPaused) return

      if (this.state === "playing" && !this.isAI) {
        this.bird.vel.y = this.jumpStrength
        this.jumpScheduled = true
        this.gameStarted = true // Start the game on first click
      } else if (
        (this.state === "menu" || (this.state === "dead" && Date.now() - this.gameOverTime > this.gameOverDelay)) &&
        !this.isAI
      ) {
        this.startGame()
      }
    })
  }

  private setupDataCollection() {
    setInterval(() => {
      // Don't collect data when paused
      if (this.isPaused || this.state !== "playing") return

      if (this.state === "playing") {
        if (this.isRecording && this.gameStarted) {
          const maxDataPoints = this.currentLevel === "underfitting" ? 50 : null

          if (maxDataPoints && this.dataset.length >= maxDataPoints) {
            // Stop recording automatically for underfitting level
            this.pauseRecording()
            console.log(
              `[v0] Recording stopped automatically - reached max data points (${maxDataPoints}) for ${this.currentLevel} level`,
            )
          } else {
            // Save previous frame's data with current frame's action
            if (this.dataBuffer !== null) {
              this.dataBuffer.pressed = this.jumpScheduled ? 1 : 0
              this.dataset.push(this.dataBuffer)
              this.onDataCountUpdate?.(this.dataset.length)
            }
            // Buffer current frame data
            this.dataBuffer = this.getCurrentData()
            this.jumpScheduled = false
          }
        }

        if (this.isAI && this.model) {
          this.makeAIPrediction()
        }
      }
    }, 100)
  }

  makeAIPrediction() {
    this.aiPredictionCount++

    const rawFeatures = this.getRawFeatures()
    const features = this.preprocessFeatures(rawFeatures)

    import("@tensorflow/tfjs")
      .then((tf) => {
        const xs = tf.tensor2d([features])
        const pred = this.model.predict(xs).dataSync()[0]
        xs.dispose()

        // Dynamic threshold based on frames since last jump
        const baseThreshold = 0.5
        const adjustedThreshold = this.framesSinceLastJump < 10 ? 0.7 : baseThreshold
        const shouldJump = pred > adjustedThreshold

        // Console logging for debugging
        if (this.aiPredictionCount % 10 === 0) {
          // Log every 10th prediction to avoid spam
          console.log(`AI Decision - Pred: ${pred.toFixed(3)}, Jump: ${shouldJump}, Y: ${this.bird.pos.y.toFixed(0)}`)
        }

        if (shouldJump) {
          this.bird.vel.y = this.jumpStrength
          this.framesSinceLastJump = 0
          console.log(`AI Jumped! Pred=${pred.toFixed(3)}, Y=${this.bird.pos.y.toFixed(0)}`)
        } else {
          this.framesSinceLastJump++
        }
      })
      .catch((error) => {
        console.error("Failed to load TensorFlow.js for prediction:", error)
      })
  }

  getRawFeatures() {
    const next = this.getNextPipe(0)
    const nextNext = this.getNextPipe(1)
    return [
      this.bird.pos.y / this.canvas.height,
      this.bird.vel.y / 10,
      next ? (next.x - this.bird.pos.x) / this.canvas.width : 1,
      next ? next.gapCenter / this.canvas.height : this.bird.pos.y / this.canvas.height,
      nextNext ? nextNext.gapCenter / this.canvas.height : this.bird.pos.y / this.canvas.height,
    ]
  }

  preprocessFeatures(rawFeatures: number[]): number[] {
    // First normalize by canvas dimensions (like original game)
    const normalizedFeatures = [
      rawFeatures[0], // y already normalized by canvas height
      rawFeatures[1], // vel already normalized by 10
      rawFeatures[2], // dist already normalized by canvas width
      rawFeatures[3], // mid1 already normalized by canvas height
      rawFeatures[4], // mid2 already normalized by canvas height
    ]

    // Then apply standardization if stats are available
    if (!this.featureStats) return normalizedFeatures

    return normalizedFeatures.map((val, i) => {
      const standardized = (val - this.featureStats!.means[i]) / (this.featureStats!.stds[i] || 1)
      return Math.max(-3, Math.min(3, standardized)) // Clamp to prevent extreme values
    })
  }

  computeStats(features: number[][]) {
    const n = features.length
    const means = new Array(5).fill(0)
    const stds = new Array(5).fill(0)

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 5; j++) {
        means[j] += features[i][j] / n
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 5; j++) {
        stds[j] += Math.pow(features[i][j] - means[j], 2) / n
      }
    }

    return {
      means,
      stds: stds.map((s) => Math.sqrt(s) || 1),
    }
  }

  startGame() {
    this.bird.reset()
    if (this.currentLevel === "overfitting") {
      this.pipes = [new Pipe(this.canvas.height, this.canvas.width, this.fixedGapCenter)]
    } else {
      this.pipes = [new Pipe(this.canvas.height, this.canvas.width)]
    }
    this.nextPipeDist = this.pipeInterval
    this.score = 0
    this.state = "playing"
    this.canvas.focus()
    this.prevSpace = false
    this.keys[" "] = false
    this.aiPredictionCount = 0
    this.framesSinceLastJump = 0
    this.dataBuffer = null
    this.jumpScheduled = false
    this.gameStarted = false
    this.hoverOffset = 0
    this.onScoreUpdate?.(this.score)
    this.onGameStateChange?.(this.state)
  }

  update() {
    // Don't update game state when paused
    if (this.isPaused || this.state !== "playing") return

    if (this.gameStarted || this.isAI) {
      // Apply gravity and move bird
      this.bird.vel.y += this.gravity
      this.bird.pos.y += this.bird.vel.y

      // Update pipes - only move when game has started
      this.nextPipeDist -= this.pipeSpeed
      if (this.nextPipeDist <= 0) {
        if (this.currentLevel === "overfitting") {
          if (this.isAI) {
            this.pipes.push(new Pipe(this.canvas.height, this.canvas.width)) // Random for AI
          } else {
            this.pipes.push(new Pipe(this.canvas.height, this.canvas.width, this.fixedGapCenter)) // Fixed for user
          }
        } else {
          this.pipes.push(new Pipe(this.canvas.height, this.canvas.width))
        }
        this.nextPipeDist = this.pipeInterval
      }

      this.pipes = this.pipes.filter((pipe) => pipe.x + pipe.width > 0)

      for (const pipe of this.pipes) {
        pipe.x -= this.pipeSpeed

        // Collision detection
        if (
          this.bird.pos.x + this.bird.radius > pipe.x &&
          this.bird.pos.x - this.bird.radius < pipe.x + pipe.width &&
          (this.bird.pos.y - this.bird.radius < pipe.top || this.bird.pos.y + this.bird.radius > pipe.bottom)
        ) {
          this.endGame()
          return
        }

        // Score update
        if (pipe.x + pipe.width < this.bird.pos.x && !pipe.passed) {
          pipe.passed = true
          this.score++
          this.onScoreUpdate?.(this.score)
        }
      }
    } else {
      this.hoverOffset += 0.05 // Slow oscillation speed
      const vibrationAmount = Math.sin(this.hoverOffset) * 2 // Small 2px vibration
      this.bird.pos.y = 300 + vibrationAmount // Keep bird at initial position with vibration
    }

    // Handle user input
    if (!this.isAI) {
      if (this.keys[" "] && !this.prevSpace) {
        this.bird.vel.y = this.jumpStrength
        this.prevSpace = true
        this.jumpScheduled = true
        this.gameStarted = true // Start the game on first space press
      }
    }

    // Check boundaries - only if game has started
    if (this.gameStarted || this.isAI) {
      if (this.bird.pos.y + this.bird.radius > this.canvas.height || this.bird.pos.y - this.bird.radius < 0) {
        this.endGame()
        return
      }
    }
  }

  endGame() {
    this.state = "dead"
    this.gameOverTime = Date.now()
    if (this.score > this.highScore) {
      this.highScore = this.score
      this.onHighScoreUpdate?.(this.highScore)
    }
    this.onGameStateChange?.(this.state)
    if (this.isAI) {
      console.log(`AI Game Over - Score: ${this.score}`)
      setTimeout(() => this.startGame(), 1000)
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.beginPath()
    this.ctx.arc(this.bird.pos.x, this.bird.pos.y, this.bird.radius, 0, Math.PI * 2)
    this.ctx.fillStyle = this.isAI ? "#ff69b4" : this.bird.color // Pink for AI, gold for human
    this.ctx.fill()
    this.ctx.strokeStyle = "#333"
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Draw pipes
    for (const pipe of this.pipes) {
      this.ctx.fillStyle = pipe.color
      this.ctx.fillRect(pipe.x, 0, pipe.width, pipe.top)
      this.ctx.fillRect(pipe.x, pipe.bottom, pipe.width, this.canvas.height - pipe.bottom)
      this.ctx.strokeStyle = "#333"
      this.ctx.strokeRect(pipe.x, 0, pipe.width, pipe.top)
      this.ctx.strokeRect(pipe.x, pipe.bottom, pipe.width, this.canvas.height - pipe.bottom)
    }
  }

  private startGameLoop() {
    const loop = () => {
      this.update()
      this.draw()
      requestAnimationFrame(loop)
    }
    loop()
  }

  // ML-related methods
  getNextPipe(offset = 0): Pipe | null {
    const upcoming = this.pipes
      .filter((pipe) => pipe.x + pipe.width > this.bird.pos.x - this.bird.radius)
      .sort((a, b) => a.x - b.x)
    return upcoming[offset] || null
  }

  getCurrentData(): GameData {
    const next = this.getNextPipe(0)
    const nextNext = this.getNextPipe(1)
    return {
      pressed: 0, // Will be set later
      y: this.bird.pos.y,
      vel: this.bird.vel.y,
      dist: next ? next.x - this.bird.pos.x : this.canvas.width,
      mid1: next ? next.gapCenter : this.canvas.height / 2,
      mid2: nextNext ? nextNext.gapCenter : this.canvas.height / 2,
    }
  }

  async trainModel() {
    const minRequired = this.currentLevel === "finetuning" ? 400 : this.currentLevel === "underfitting" ? 50 : 200

    if (this.dataset.length < minRequired) {
      alert(`Need at least ${minRequired} data points to train effectively for ${this.currentLevel} level!`)
      return
    }

    this.onProgressUpdate?.(10, "Preparing dataset...")

    const trainer = new MLTrainer()

    try {
      const result = await trainer.trainModel(
        this.dataset,
        this.canvas.height,
        this.canvas.width,
        this.currentLevel, // Pass current level to trainer
        this.onTrainingStatusUpdate,
        this.onProgressUpdate,
      )

      this.model = result.model
      this.featureStats = result.featureStats

      console.log(`=== Model Training Results (${this.currentLevel.toUpperCase()}) ===`)
      console.log("Training completed successfully")
    } catch (error) {
      console.error("Training failed:", error)
      throw error
    }
  }

  // Control methods
  startRecording() {
    this.isRecording = true
    this.dataBuffer = null
    console.log("Recording started")
  }

  pauseRecording() {
    this.isRecording = false
    console.log("Recording paused")
  }

  resumeRecording() {
    this.isRecording = true
    console.log("Recording resumed")
  }

  clearDataset() {
    this.dataset = []
    this.onDataCountUpdate?.(0)
    console.log("Dataset cleared")
  }

  downloadCSV() {
    if (this.dataset.length === 0) {
      alert("No data to download!")
      return
    }
    const csv =
      "pressed,y,vel,dist,mid1,mid2\n" +
      this.dataset
        .map(
          (row) =>
            `${row.pressed},${row.y.toFixed(2)},${row.vel.toFixed(2)},${row.dist.toFixed(2)},${row.mid1.toFixed(2)},${row.mid2.toFixed(2)}`,
        )
        .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "flappy_data.csv"
    a.click()
    URL.revokeObjectURL(url)
    console.log(`Downloaded ${this.dataset.length} data points`)
  }

  async uploadCSV(file: File) {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const lines = text.split("\n")
        const headers = lines[0].split(",")

        // Validate headers
        if (headers.join(",") !== "pressed,y,vel,dist,mid1,mid2") {
          alert("Invalid CSV format! Headers must be: pressed,y,vel,dist,mid1,mid2")
          reject(new Error("Invalid CSV format"))
          return
        }

        // Parse data
        const newData = []
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === "") continue
          const values = lines[i].split(",")
          if (values.length !== 6) continue

          newData.push({
            pressed: Number.parseInt(values[0]),
            y: Number.parseFloat(values[1]),
            vel: Number.parseFloat(values[2]),
            dist: Number.parseFloat(values[3]),
            mid1: Number.parseFloat(values[4]),
            mid2: Number.parseFloat(values[5]),
          })
        }

        if (newData.length > 0) {
          this.dataset = [...this.dataset, ...newData]
          this.onDataCountUpdate?.(this.dataset.length)
          console.log(`Uploaded ${newData.length} data points. Total: ${this.dataset.length}`)
          alert(`Successfully loaded ${newData.length} data points!`)
          resolve()
        } else {
          alert("No valid data found in CSV!")
          reject(new Error("No valid data found"))
        }
      }
      reader.readAsText(file)
    })
  }

  startAI() {
    if (!this.model) {
      alert("Train the model first!")
      return
    }
    this.isAI = true
    if (this.state === "menu" || this.state === "dead") {
      this.startGame()
    }
    console.log("AI Play started")
  }

  stopAI() {
    this.isAI = false
    if (this.state === "playing") {
      this.endGame()
    }
    console.log("AI Play stopped - Game ended")
  }

  restart() {
    // Clear all game state
    this.bird.reset()
    this.pipes = []
    this.score = 0
    this.state = "menu"
    this.keys = {}
    this.prevSpace = false
    this.aiPredictionCount = 0
    this.framesSinceLastJump = 0
    this.dataBuffer = null
    this.jumpScheduled = false
    this.gameStarted = false
    this.hoverOffset = 0
    this.gameOverTime = 0

    // Clear ML-related state
    this.dataset = []
    this.isRecording = false
    this.isAI = false
    this.model = null
    this.featureStats = null

    // Update UI
    this.onScoreUpdate?.(this.score)
    this.onDataCountUpdate?.(0)
    this.onGameStateChange?.(this.state)
    this.onTrainingStatusUpdate?.(`No Model (${this.currentLevel})`)

    console.log(`Game completely restarted for ${this.currentLevel} level`)
  }

  pause() {
    if (this.isPaused) return // Already paused

    console.log("[GameEngine] Pausing game")
    this.isPaused = true

    // Save current state
    this.pausedState = {
      gameState: this.state,
      gameStarted: this.gameStarted,
      hoverOffset: this.hoverOffset
    }
  }

  resume() {
    if (!this.isPaused) return // Not paused

    console.log("[GameEngine] Resuming game")
    this.isPaused = false

    // Restore state if it was saved
    if (this.pausedState) {
      // Note: We don't restore gameState here as it might have changed
      // We mainly preserve gameStarted and hoverOffset for smooth continuation
      this.pausedState = null
    }
  }

  get paused() {
    return this.isPaused
  }
}
