/**
 * Gemini Chat
 *
 * Streaming chat completions using Gemini 2.0 Flash.
 */

import { getGeminiClient } from './client'

const CHAT_MODEL = 'gemini-2.0-flash'

/**
 * Stream a chat response given a system prompt and user message.
 * Returns a ReadableStream<string> that yields tokens as they arrive.
 */
export async function streamChatResponse(
  systemPrompt: string,
  userMessage: string
): Promise<ReadableStream<string>> {
  const client = getGeminiClient()
  const model = client.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction: systemPrompt,
  })

  const result = await model.generateContentStream(userMessage)

  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            controller.enqueue(text)
          }
        }
      } finally {
        controller.close()
      }
    },
  })
}

/**
 * Non-streaming chat completion for LLM-as-judge scoring.
 * Returns the full response text.
 */
export async function chatCompletion(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const client = getGeminiClient()
  const model = client.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction: systemPrompt,
  })

  const result = await model.generateContent(userMessage)
  return result.response.text()
}
