import { chat, chatWithTools } from "@/services/llm/client"
import type { ToolDefinition } from "@/services/llm/types"
import type { ChatMessage, AgentResponse } from "@/types"
import { prisma } from "@/lib/prisma"

export interface AgentConfig {
  systemPrompt: string
  tools: ToolDefinition[]
  model?: string
  temperature?: number
  maxTokens?: number
}

export abstract class BaseAgent {
  protected config: AgentConfig

  constructor(config: AgentConfig) {
    this.config = config
  }

  async chat(
    userMessage: string,
    history: ChatMessage[],
    extraContext?: string
  ): Promise<AgentResponse> {
    const messages: ChatMessage[] = [
      { role: "system", content: this.buildSystemPrompt(extraContext) },
      ...history,
      { role: "user", content: userMessage },
    ]

    if (this.config.tools.length > 0) {
      const res = await chatWithTools(messages, this.config.tools, {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        model: this.config.model,
      })

      const data: Record<string, unknown> = {}
      if (res.toolCalls.length > 0) {
        for (const tc of res.toolCalls) {
          try {
            const result = await this.executeTool(tc.name, tc.arguments)
            data[tc.name] = result
          } catch (e) {
            data[tc.name] = { error: String(e) }
          }
        }

        messages.push({ role: "assistant", content: res.content })
        messages.push({
          role: "user",
          content: `工具执行结果：${JSON.stringify(data)}。请根据这些结果回答用户的问题。`,
        })
        const followUp = await chat(messages, {
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          model: this.config.model,
        })
        return { content: followUp.content, toolCalls: res.toolCalls, data }
      }

      return { content: res.content, data }
    }

    const res = await chat(messages, {
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      model: this.config.model,
    })
    return { content: res.content }
  }

  protected buildSystemPrompt(extraContext?: string): string {
    let prompt = this.config.systemPrompt
    if (extraContext) {
      prompt += `\n\n# 当前上下文数据\n${extraContext}`
    }
    return prompt
  }

  protected abstract executeTool(name: string, args: Record<string, unknown>): Promise<unknown>

  async logAction(
    agentType: string,
    action: string,
    input: string,
    output: string,
    tokensUsed: number,
    sessionId?: string,
    lessonId?: string
  ): Promise<void> {
    await prisma.agentLog.create({
      data: {
        agentType,
        sessionId: sessionId || null,
        lessonId: lessonId || null,
        action,
        input: input.slice(0, 5000),
        output: output.slice(0, 5000),
        tokensUsed,
      },
    })
  }
}
