import OpenAI from "openai"
import type { ChatMessage } from "@/types"
import type { LLMResponse, ToolDefinition } from "./types"

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "sk-placeholder",
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
})

export async function chat(
  messages: ChatMessage[],
  options?: {
    tools?: ToolDefinition[]
    temperature?: number
    maxTokens?: number
    model?: string
  }
): Promise<LLMResponse> {
  const model = options?.model || "deepseek-chat"

  const params: Record<string, unknown> = {
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  }

  if (options?.tools?.length) {
    params.tools = options.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))
  }

  const completion = await openai.chat.completions.create(params as any)

  const choice = completion.choices[0]
  const response: LLMResponse = {
    content: choice.message?.content || "",
    toolCalls: [],
    usage: {
      promptTokens: completion.usage?.prompt_tokens || 0,
      completionTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
    },
  }

  if (choice.message?.tool_calls) {
    response.toolCalls = choice.message.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name || "",
      arguments: JSON.parse(tc.function?.arguments || "{}"),
    }))
  }

  return response
}

export async function chatWithTools(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  options?: { temperature?: number; maxTokens?: number; model?: string }
): Promise<LLMResponse> {
  return chat(messages, { ...options, tools })
}

export async function chatSimple(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; model?: string }
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ]
  const res = await chat(messages, options)
  return res.content
}
