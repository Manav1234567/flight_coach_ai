import type { GameData, FeatureStats } from "./game-engine"

export class MLTrainer {
  private preprocessFeatures(rawFeatures: number[], featureStats: FeatureStats | null): number[] {
    // First normalize by canvas dimensions (like original game)
    const normalizedFeatures = [
      rawFeatures[0], // y already normalized by canvas height
      rawFeatures[1], // vel already normalized by 10
      rawFeatures[2], // dist already normalized by canvas width
      rawFeatures[3], // mid1 already normalized by canvas height
      rawFeatures[4], // mid2 already normalized by canvas height
    ]

    // Then apply standardization if stats are available
    if (!featureStats) return normalizedFeatures

    return normalizedFeatures.map((val, i) => {
      const standardized = (val - featureStats.means[i]) / (featureStats.stds[i] || 1)
      return Math.max(-3, Math.min(3, standardized)) // Clamp to prevent extreme values
    })
  }

  private computeStats(features: number[][]): FeatureStats {
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

  async trainModel(
    dataset: GameData[],
    canvasHeight: number,
    canvasWidth: number,
    currentLevel: string, // Added level parameter
    onStatusUpdate?: (status: string) => void,
    onProgressUpdate?: (percent: number, text: string) => void,
  ): Promise<{ model: any; featureStats: FeatureStats }> {
    if (dataset.length < 50) {
      throw new Error("Need at least 50 data points to train effectively!")
    }

    const tf = await import("@tensorflow/tfjs")

    onProgressUpdate?.(10, "Loading your recording...")

    let finalDataset = [...dataset]
    if (currentLevel === "finetuning") {
      try {
        onProgressUpdate?.(15, "Loading additional training data...")
        const response = await fetch("/existing_game_play.csv") // local file in public/
        const csvText = await response.text()
        const lines = csvText.split("\n")

        // Parse first 500 entries (skip header)
        const additionalData: GameData[] = []
        for (let i = 1; i < Math.min(501, lines.length); i++) {
          if (lines[i].trim() === "") continue
          const values = lines[i].split(",")
          if (values.length !== 6) continue

          additionalData.push({
            pressed: Number.parseInt(values[0]),
            y: Number.parseFloat(values[1]),
            vel: Number.parseFloat(values[2]),
            dist: Number.parseFloat(values[3]),
            mid1: Number.parseFloat(values[4]),
            mid2: Number.parseFloat(values[5]),
          })
        }

        finalDataset = [...dataset, ...additionalData]
        console.log(
          `[v0] Finetuning: Added ${additionalData.length} additional training examples`
        )
      } catch (error) {
        console.warn("[v0] Failed to load additional training data:", error)
        // Continue with original dataset if fetch fails
      }
    }

    const rawFeatures = finalDataset.map((d) => [
      d.y / canvasHeight,
      d.vel / 10,
      d.dist / canvasWidth,
      d.mid1 / canvasHeight,
      d.mid2 / canvasHeight,
    ])
    const labels = finalDataset.map((d) => [d.pressed])

    onProgressUpdate?.(30, "Learning from your recording...")

    // Apply same preprocessing as inference
    const processedFeatures = rawFeatures.map((raw) => this.preprocessFeatures(raw, null))

    // Balance dataset
    const class0 = finalDataset.filter((d) => d.pressed === 0)
    const class1 = finalDataset.filter((d) => d.pressed === 1)
    console.log(`Class balance - Jump: ${class1.length}, No Jump: ${class0.length}`)

    let balancedFeatures, balancedLabels
    if (class1.length > 0) {
      const ratio = Math.min(2, class0.length / class1.length)
      const sampleSize = Math.floor(class1.length * ratio)
      const step = Math.floor(class0.length / sampleSize)
      const sampledClass0 = []
      const sampledClass0Labels = []
      for (let i = 0; i < class0.length; i += step) {
        if (sampledClass0.length < sampleSize) {
          sampledClass0.push(class0[i])
          sampledClass0Labels.push([0]) // Ensure labels are arrays
        }
      }
      balancedFeatures = [
        ...sampledClass0.map((d) => [
          d.y / canvasHeight,
          d.vel / 10,
          d.dist / canvasWidth,
          d.mid1 / canvasHeight,
          d.mid2 / canvasHeight,
        ]),
        ...class1.map((d) => [
          d.y / canvasHeight,
          d.vel / 10,
          d.dist / canvasWidth,
          d.mid1 / canvasHeight,
          d.mid2 / canvasHeight,
        ]),
      ]
      balancedLabels = [...sampledClass0Labels, ...class1.map((d) => [1])] // Ensure labels are arrays
    } else {
      throw new Error("No jump actions recorded! Please record some gameplay with jumps.")
    }

    // Shuffle
    const indices = Array.from({ length: balancedFeatures.length }, (_, i) => i)
    indices.sort(() => Math.random() - 0.5)
    balancedFeatures = indices.map((i) => balancedFeatures[i])
    balancedLabels = indices.map((i) => balancedLabels[i])

    onProgressUpdate?.(50, "Splitting data...")

    // Train-test split
    const trainSize = Math.floor(0.8 * balancedFeatures.length)
    const trainFeatures = balancedFeatures.slice(0, trainSize)
    const trainLabels = balancedLabels.slice(0, trainSize)
    const testFeatures = balancedFeatures.slice(trainSize)
    const testLabels = balancedLabels.slice(trainSize)

    const xsTrain = tf.tensor2d(trainFeatures)
    const ysTrain = tf.tensor2d(trainLabels)
    const xsTest = tf.tensor2d(testFeatures)
    const ysTest = tf.tensor2d(testLabels)

    onProgressUpdate?.(60, "Building model...")

    // Create model
    const model = tf.sequential()
    model.add(
      tf.layers.dense({
        inputShape: [5],
        units: 10,
        activation: "relu",
        kernelInitializer: "glorotUniform",
      }),
    )
    model.add(tf.layers.dropout({ rate: 0.1 }))
    model.add(
      tf.layers.dense({
        units: 5,
        activation: "relu",
      }),
    )
    model.add(
      tf.layers.dense({
        units: 1,
        activation: "sigmoid",
      }),
    )

    model.compile({
      optimizer: tf.train.adam(0.005),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    })

    onProgressUpdate?.(70, "Learning from your recording...")

    await model.fit(xsTrain, ysTrain, {
      epochs: 150,
      batchSize: 16,
      validationData: [xsTest, ysTest],
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const progress = 70 + (epoch / 150) * 20 // 70-90% for training
          onProgressUpdate?.(progress, `Learning from your recording... Epoch ${epoch + 1}/150`)

          if (epoch % 30 === 0) {
            console.log(`Epoch ${epoch}: Loss=${logs.loss.toFixed(4)}, Acc=${logs.acc.toFixed(4)}`)
          }
        },
      },
    })

    onProgressUpdate?.(90, "Finalizing model...")

    // Evaluate
    const predsTest = model.predict(xsTest).dataSync()
    const truesTest = ysTest.dataSync()
    let tp = 0,
      fp = 0,
      fn = 0,
      tn = 0

    for (let i = 0; i < predsTest.length; i++) {
      const pred = predsTest[i] > 0.5 ? 1 : 0
      const true_val = truesTest[i]

      if (pred === 1 && true_val === 1) tp++
      else if (pred === 1 && true_val === 0) fp++
      else if (pred === 0 && true_val === 1) fn++
      else tn++
    }

    const precision = tp / (tp + fp) || 0
    const recall = tp / (tp + fn) || 0
    const f1 = (2 * precision * recall) / (precision + recall) || 0
    const accuracy = (tp + tn) / (tp + tn + fp + fn)

    console.log("=== ML Trainer Results ===")
    console.log("Balanced dataset size:", balancedFeatures.length)
    console.log("Original dataset size:", dataset.length) // Show original user dataset size
    if (currentLevel === "finetuning") {
      console.log("Final dataset size (with additional data):", finalDataset.length)
    }

    console.log(`Accuracy: ${(accuracy * 100).toFixed(1)}%`)
    console.log(`Precision: ${(precision * 100).toFixed(1)}%`)
    console.log(`Recall: ${(recall * 100).toFixed(1)}%`)
    console.log(`F1 Score: ${f1.toFixed(3)}`)

    onProgressUpdate?.(100, "Training complete!")

    if (currentLevel === "finetuning") {
      onStatusUpdate?.(`Model ready! Try more recordings to improve performance.`)
    } else if (currentLevel === "underfitting") {
      onStatusUpdate?.(`Model ready! Move on to see overfitting and how it works.`)
    } else if (currentLevel === "overfitting") {
      onStatusUpdate?.(`Model ready! Notice how bias is introduced in your recording.`)
    } else {
      onStatusUpdate?.(`Model Ready! (${(accuracy * 100).toFixed(1)}% accuracy)`)
    }

    // Clean up
    xsTrain.dispose()
    ysTrain.dispose()
    xsTest.dispose()
    ysTest.dispose()

    return { model, featureStats: null } // Return null featureStats as it's not computed here
  }
}
