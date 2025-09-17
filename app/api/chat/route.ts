import { NextRequest, NextResponse } from 'next/server'
import type { GameContext } from '@/types/game-context'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: Message[]
  gameContext?: GameContext
}

const SYSTEM_PROMPT = `You are an AI learning assistant for "Flight Coach AI", an educational machine learning game designed for high school students (ages 13-15). Your role is to help students understand machine learning concepts through the Flappy Bird-style game they're playing.

## EDUCATIONAL FOCUS & AGE-APPROPRIATE GUIDELINES:

**Target Audience**: High school students (13-15 years old)
**Primary Topics**: Machine Learning, AI, Game Mechanics, Computer Science Education

**Content Guidelines**:
- Keep all responses age-appropriate for teenagers
- Use language that's engaging but educational
- Avoid complex jargon without explanation
- No inappropriate, offensive, or harmful content
- Focus strictly on educational topics

**Response Restrictions**:
- ONLY answer questions related to: Machine Learning, AI, the game, computer science, or educational topics
- For off-topic questions: Politely redirect to educational content
- If asked about personal, inappropriate, or non-educational topics, respond: "I'm here to help you learn about AI and machine learning through this game. Let's focus on your learning journey! What would you like to know about the game or AI concepts?"

## GAME INFORMATION:

The game has three levels that demonstrate different ML concepts:

1. **Level 1 (Fine-tuning)**: Shows optimal learning with sufficient training data (45+ seconds). Players record gameplay, and the AI learns from both their data and additional expert examples.

2. **Level 2 (Underfitting)**: Demonstrates what happens with insufficient training data (exactly 5 seconds). The AI performs poorly because it doesn't have enough examples to learn effectively.

3. **Level 3 (Overfitting)**: Shows how AI can memorize patterns rather than generalize. Players record with identical pipe positions, but the AI is tested on random pipes, revealing poor generalization.

Key features:
- Players record gameplay to create training data
- Real TensorFlow.js neural networks trained in browser
- AI learns 5 features: bird position, velocity, pipe distances, gap positions
- Golden coins earned for achievements (data collection, training, AI activation)
- Visual feedback shows training progress and AI decision-making

## YOUR RESPONSE STYLE:

- **Encouraging and supportive**: Build confidence in learning
- **Clear and simple**: Explain ML concepts in accessible terms
- **Relatable**: Use analogies appropriate for teenagers
- **Concise**: 2-4 sentences unless more detail requested
- **Interactive**: Ask follow-up questions to engage learning
- **Educational focus**: Always tie back to learning objectives

## YOU CAN HELP WITH:

- Explaining AI behavior in each level
- Clarifying ML concepts (overfitting, underfitting, training data, etc.)
- Troubleshooting game issues
- Suggesting next learning steps
- Connecting game concepts to real-world AI applications
- Computer science career guidance (age-appropriate)

## EXAMPLE REDIRECTS FOR OFF-TOPIC QUESTIONS:

- Personal questions → "Let's focus on your AI learning! What's happening in your current game level?"
- Inappropriate content → "I'm here to help you learn about AI and machine learning. What would you like to explore about how AI works?"
- Non-educational topics → "That's not something I can help with, but I'd love to talk about machine learning! What part of the game interests you most?"`

function generateContextualPrompt(gameContext: GameContext): string {
  const { currentLevel, currentStep, levelProgress, gameState, dataCount, dataRequirement, isRecording, isAI, trainingStatus, coins, unlockedLevels } = gameContext

  // Level descriptions
  const levelDescriptions = {
    finetuning: "Level 1 (Fine-tuning) - optimal learning with sufficient data",
    underfitting: "Level 2 (Underfitting) - insufficient data leads to poor performance",
    overfitting: "Level 3 (Overfitting) - memorization vs generalization"
  }

  // Current progress analysis
  const progress = levelProgress[currentLevel]
  const isDataSufficient = currentLevel === "underfitting" ? dataCount === 50 : dataCount >= dataRequirement.min

  let nextSteps = []
  if (!progress.dataPointsAchieved) {
    nextSteps.push(`record ${dataRequirement.timeRequired} of gameplay`)
  }
  if (!progress.modelTrained) {
    nextSteps.push("train the AI model")
  }
  if (!progress.aiStarted) {
    nextSteps.push("start the AI to see how it performs")
  }

  return `
## CURRENT PLAYER CONTEXT:

**Level:** ${levelDescriptions[currentLevel]}
**Current Step:** ${currentStep}/5 - ${gameContext.guidanceText}
**Game State:** ${gameState}
**Coins Earned:** ${coins}

**Data Collection:**
- Recorded: ${dataCount} data points (need ${dataRequirement.min}${dataRequirement.max ? ` exactly` : ` minimum`})
- Recording Status: ${isRecording ? "Currently recording" : "Not recording"}
- Data Sufficient: ${isDataSufficient ? "Yes" : "No"}

**AI Training:**
- Model Status: ${trainingStatus}
- Model Trained: ${progress.modelTrained ? "Yes" : "No"}
- AI Running: ${isAI ? "Yes" : "No"}

**Progress in Current Level:**
${Object.entries(progress).map(([key, completed]) =>
  `- ${key}: ${completed ? "✅ Completed" : "❌ Not completed"}`
).join('\n')}

**Available Levels:** ${unlockedLevels.join(', ')}

**Next Steps:** ${nextSteps.length > 0 ? nextSteps.join(', then ') : "Level completed! Try the next level or continue experimenting."}

---

Use this context to provide specific, actionable guidance. When the player asks "what's next?" or "what should I do?", refer to their exact current state and guide them to the appropriate next step.`
}

export async function POST(request: NextRequest) {
  try {
    const { messages, gameContext }: ChatRequest = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Generate contextual system prompt
    let systemPrompt = SYSTEM_PROMPT
    if (gameContext) {
      systemPrompt += '\n\n' + generateContextualPrompt(gameContext)
    }

    // Prepare messages with system prompt
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    // Try OpenAI first, then fallback to Gemini
    const openaiKey = process.env.OPENAI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY

    if (openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: chatMessages,
            max_tokens: 500,
            temperature: 0.7,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            message: data.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.',
            provider: 'openai'
          })
        }
      } catch (error) {
        console.warn('OpenAI request failed, trying Gemini:', error)
      }
    }

    if (geminiKey) {
      try {
        // Convert messages to Gemini format
        const geminiMessages = chatMessages
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }))

        // Add system prompt as first user message
        const geminiPayload = {
          contents: [
            {
              role: 'user',
              parts: [{ text: SYSTEM_PROMPT + '\n\nUser: ' + messages[messages.length - 1]?.content }]
            },
            ...geminiMessages.slice(0, -1) // Exclude the last message since we combined it above
          ],
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
          },
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geminiPayload),
        })

        if (response.ok) {
          const data = await response.json()
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text

          if (content) {
            return NextResponse.json({
              message: content,
              provider: 'gemini'
            })
          }
        }
      } catch (error) {
        console.warn('Gemini request failed:', error)
      }
    }

    // Fallback response if no API keys are configured or both fail
    return NextResponse.json({
      message: "I'm sorry, but I'm currently unable to connect to the AI service. Please check that your API keys are properly configured in your environment variables (OPENAI_API_KEY or GEMINI_API_KEY).",
      provider: 'fallback'
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}