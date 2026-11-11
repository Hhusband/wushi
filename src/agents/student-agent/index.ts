import { BaseAgent, type AgentConfig } from "@/agents/base-agent"
import { STUDENT_AGENT_PROMPT } from "@/prompts/student"
import type { ChatMessage, AgentResponse } from "@/types"
import { prisma } from "@/lib/prisma"
import { END_DISCUSSION_KEYWORDS, SUBJECT_GUIDANCE } from "@/lib/constants"

export class StudentAgent extends BaseAgent {
  private sessionId: string
  private lessonContext: {
    subject: string
    grade: string
    className: string
    groupName: string
    lessonName: string
    coreQuestion: string
    followUpQuestions: string[]
    discussionRequirements: string
  }

  constructor(
    sessionId: string,
    lessonContext: {
      subject: string
      grade: string
      className: string
      groupName: string
      lessonName: string
      coreQuestion: string
      followUpQuestions: string[]
      discussionRequirements: string
    }
  ) {
    const tools = [
      {
        name: "get_lesson_context",
        description: "获取当前课程信息",
        parameters: { type: "object", properties: {}, required: [] },
      },
    ]

    const guidance = SUBJECT_GUIDANCE[lessonContext.subject] || SUBJECT_GUIDANCE["语文"]

    const config: AgentConfig = {
      systemPrompt: STUDENT_AGENT_PROMPT
        .replace("{{grade}}", lessonContext.grade)
        .replace("{{className}}", lessonContext.className)
        .replace("{{groupName}}", lessonContext.groupName)
        .replace("{{lessonName}}", lessonContext.lessonName)
        .replace("{{coreQuestion}}", lessonContext.coreQuestion)
        .replace("{{discussionRequirements}}", lessonContext.discussionRequirements || "请结合学习内容进行讨论。")
        .replace(/{{subject}}/g, lessonContext.subject)
        .replace("{{subjectGuidance}}", guidance.guidance),
      tools,
      temperature: 0.7,
      maxTokens: 1024,
    }

    super(config)
    this.sessionId = sessionId
    this.lessonContext = lessonContext
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
        role: "student",
        authorName: authorName || null,
        content: userMessage,
      },
    })

    // Check if end of discussion
    const isEndSignal = this.detectEndSignal(userMessage)

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
