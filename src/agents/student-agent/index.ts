import { BaseAgent, type AgentConfig } from "@/agents/base-agent"
import { STUDENT_AGENT_PROMPT } from "@/prompts/student"
import type { ChatMessage, AgentResponse } from "@/types"
import { prisma } from "@/lib/prisma"
import { END_DISCUSSION_KEYWORDS, SUBJECT_GUIDANCE } from "@/lib/constants"

export interface StudentAgentContext {
  subject: string
  grade: string
  className: string
  groupName: string
  lessonName: string
  coreQuestion: string
  followUpQuestions: string[]
  discussionRequirements: string
  /** 当前讨论轮次（V1.6 分轮讨论）；为空时退回到单轮行为 */
  roundId?: string | null
  roundSeq?: number
  roundQuestion?: string
  roundRequirements?: string
  allowSubmit?: boolean
}

export class StudentAgent extends BaseAgent {
  private sessionId: string
  private lessonContext: StudentAgentContext
  private roundId: string | null

  constructor(sessionId: string, lessonContext: StudentAgentContext) {
    const tools = [
      {
        name: "get_lesson_context",
        description: "获取当前课程信息",
        parameters: { type: "object", properties: {}, required: [] },
      },
    ]

    const guidance = SUBJECT_GUIDANCE[lessonContext.subject] || SUBJECT_GUIDANCE["语文"]

    // 分轮讨论：本轮问题/要求优先于课程的核心问题
    const question = (lessonContext.roundQuestion || "").trim() || lessonContext.coreQuestion
    const requirements =
      (lessonContext.roundRequirements || "").trim() || lessonContext.discussionRequirements

    let systemPrompt = STUDENT_AGENT_PROMPT
      .replace("{{grade}}", lessonContext.grade)
      .replace("{{className}}", lessonContext.className)
      .replace("{{groupName}}", lessonContext.groupName)
      .replace("{{lessonName}}", lessonContext.lessonName)
      .replace("{{coreQuestion}}", question)
      .replace("{{discussionRequirements}}", requirements || "请结合学习内容进行讨论。")
      .replace(/{{subject}}/g, lessonContext.subject)
      .replace("{{subjectGuidance}}", guidance.guidance)

    if ((lessonContext.roundSeq || 1) > 1) {
      systemPrompt += `

# 当前轮次
这是本课的第 ${lessonContext.roundSeq} 轮讨论，前面已经讨论过其他问题。请围绕上面「核心问题」中给出的本轮新问题展开，不要重复之前的讨论内容；学生如果提到上一轮的结论，可以承接。`
    }

    if (lessonContext.allowSubmit === false) {
      systemPrompt += `

# 重要：本轮不结束
本轮讨论由老师决定何时结束。即使学生说"没有了""没有补充了""结束吧""提交吧"，也绝对不要生成【讨论总结】、不要宣布已提交。请改为鼓励性的回应，例如"很好，还有其他小组想补充吗？"，继续围绕本轮问题讨论。`
    }

    const config: AgentConfig = {
      systemPrompt,
      tools,
      temperature: 0.7,
      maxTokens: 1024,
    }

    super(config)
    this.sessionId = sessionId
    this.lessonContext = lessonContext
    this.roundId = lessonContext.roundId || null
  }

  async discuss(
    userMessage: string,
    authorName: string | undefined,
    history: ChatMessage[]
  ): Promise<AgentResponse> {
    // Save user message
    await prisma.message.create({
      data: {
        sessionId: this.sessionId,
        roundId: this.roundId,
        role: "student",
        authorName: authorName || null,
        content: userMessage,
      },
    })

    const extraContext = await this.buildExtraContext()

    // Load message history for the agent
    const allMessages = await prisma.message.findMany({
      where: { sessionId: this.sessionId },
      orderBy: { createdAt: "asc" },
      take: 50,
    })

    const chatHistory: ChatMessage[] = allMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.role === "student" ? `[${m.authorName || "学生"}] ${m.content}` : m.content,
    }))

    // Update session timestamp
    await prisma.studentSession.update({
      where: { id: this.sessionId },
      data: { updatedAt: new Date() },
    })

    return this.chat(userMessage, chatHistory, extraContext)
  }

  private detectEndSignal(message: string): boolean {
    return END_DISCUSSION_KEYWORDS.some((kw) => message.includes(kw))
  }

  private async buildExtraContext(): Promise<string> {
    const session = await prisma.studentSession.findUnique({
      where: { id: this.sessionId },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 20 } },
    })

    if (!session) return ""

    const recentMessages = session.messages.reverse()
    const messageCount = await prisma.message.count({ where: { sessionId: this.sessionId } })

    return `
当前讨论进度:
- 小组状态: ${session.status}
- 总消息数: ${messageCount}

最近讨论内容:
${recentMessages.map((m) => `[${m.role}] ${m.content.slice(0, 200)}`).join("\n")}
`
  }

  protected async executeTool(name: string, _args: Record<string, unknown>): Promise<unknown> {
    if (name === "get_lesson_context") {
      return this.lessonContext
    }
    return {}
  }
}
