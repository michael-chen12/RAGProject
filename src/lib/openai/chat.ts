import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Streams a chat response using the OpenAI SDK's streaming API.
 *
 * Returns a ReadableStream<string> that yields tokens as they arrive.
 * The caller (API route) is responsible for encoding these tokens as SSE
 * and appending the [CITATIONS] event after the stream closes.
 *
 * Model: gpt-4o-mini — fast and cost-effective for knowledge base Q&A.
 */
export async function streamChatResponse(
  systemPrompt: string,
  userMessage: string
): Promise<ReadableStream<string>> {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  })

  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content ?? ''
          if (token) controller.enqueue(token)
        }
      } finally {
        controller.close()
      }
    },
  })
}
