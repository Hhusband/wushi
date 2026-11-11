import { BaseAgent, type AgentConfig } from "@/agents/base-agent"
import { TEACHER_AGENT_PROMPT } from "@/prompts/teacher"
import type { ChatMessage, AgentResponse } from "@/types"
import { prisma } from "@/lib/prisma"
import { SUBJECT_GUIDANCE } from "@/lib/constants"

export class TeacherAgent extends BaseAgent {
  private currentLessonId: string

  constructor(currentLessonId: string) {
    const tools = [
      {
        name: "get_dashboard_data",
        description: "获取实时课堂仪表盘数据，包含各小组状态、关键词云、观点分布等",
        parameters: { type: "object", properties: {}, required: [] },
      },
      {
        name: "get_session_detail",
        description: "查看某个小组的详细讨论记录",
        parameters: {
          type: "object",
          properties: { sessionId: { type: "string", description: "小组会话ID" } },
          required: ["sessionId"],
        },
      },
      {
        name: "get_all_submissions",
        description: "获取所有已提交的小组成果",
        parameters: { type: "object", properties: {}, required: [] },
      },
    ]

    const config: AgentConfig = {
      systemPrompt: TEACHER_AGENT_PROMPT,
      tools,
      temperature: 0.7,
      maxTokens: 2048,
    }

    super(config)
    this.currentLessonId = currentLessonId
  }

  async answer(userMessage: string, history: ChatMessage[]): Promise<AgentResponse> {
    const extraContext = await this.buildExtraContext()
    return this.chat(userMessage, history, extraContext)
  }

  private async buildExtraContext(): Promise<string> {
    const currentLesson = await prisma.currentLesson.findUnique({
      where: { id: this.currentLessonId },
      include: { lesson: true },
    })

    if (!currentLesson) return "暂无课堂数据"

    const sessions = await prisma.studentSession.findMany({
      where: { currentLessonId: this.currentLessonId },
    })

    const submissions = await prisma.submission.findMany({
      where: { currentLessonId: this.currentLessonId },
    })

    const allMessages = await prisma.message.findMany({
      where: { session: { currentLessonId: this.currentLessonId } },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    // Build a rich context string
    const submittedCount = submissions.length
    const activeCount = sessions.filter((s) => s.status === "active").length

    const sessionSummaries = await Promise.all(
      sessions.map(async (s) => {
        const msgCount = await prisma.message.count({ where: { sessionId: s.id } })
        const recentMessages = await prisma.message.findMany({
          where: { sessionId: s.id },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
        return {
          id: s.id,
          groupName: s.groupName,
          status: s.status,
          messageCount: msgCount,
          recentContent: recentMessages.map((m) => m.content.slice(0, 100)).join(" | "),
        }
      })
    )

    const submissionSummaries = submissions.map((sub) => ({
      groupName: sub.groupName,
      mainPoints: sub.mainPoints,
      conclusions: sub.conclusions?.slice(0, 300),
      questions: sub.questions?.slice(0, 200),
    }))

    // Update system prompt with real data
    const subject = currentLesson.lesson.subject || "语文"
    const guidance = SUBJECT_GUIDANCE[subject] || SUBJECT_GUIDANCE["语文"]

    const dataPrompt = TEACHER_AGENT_PROMPT
      .replace("{{grade}}", currentLesson.grade)
      .replace("{{className}}", currentLesson.className)
      .replace("{{lessonName}}", currentLesson.lesson.lessonName)
      .replace("{{coreQuestion}}", currentLesson.lesson.coreQuestion)
      .replace("{{totalGroups}}", String(sessions.length))
      .replace("{{submittedCount}}", String(submittedCount))
      .replace("{{activeCount}}", String(activeCount))
      .replace(/{{subject}}/g, subject)
      .replace("{{teacherRole}}", guidance.role)

    this.config.systemPrompt = dataPrompt

    return `
## 实时课堂数据

### 各小组状态
${JSON.stringify(sessionSummaries, null, 2)}

### 已提交成果
${JSON.stringify(submissionSummaries, null, 2)}

### 最近讨论内容（所有小组）
${allMessages.slice(0, 30).map((m) => `[${m.role}] ${m.content.slice(0, 150)}`).join("\n")}
`
  }

  protected async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "get_dashboard_data": {
        const sessions = await prisma.studentSession.findMany({
          where: { currentLessonId: this.currentLessonId },
        })
        const submissions = await prisma.submission.findMany({
          where: { currentLessonId: this.currentLessonId },
        })
        const messages = await prisma.message.findMany({
          where: { session: { currentLessonId: this.currentLessonId } },
          orderBy: { createdAt: "desc" },
          take: 300,
        })

        return {
          totalGroups: sessions.length,
          submittedGroups: submissions.length,
          activeGroups: sessions.filter((s) => s.status === "active").length,
          sessions: sessions.map((s) => ({
            id: s.id,
            groupName: s.groupName,
            status: s.status,
          })),
          recentMessages: messages.slice(0, 50).map((m) => ({
            role: m.role,
            content: m.content.slice(0, 200),
          })),
        }
      }

      case "get_session_detail": {
        const sessionId = args.sessionId as string
        const session = await prisma.studentSession.findUnique({
          where: { id: sessionId },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
        })
        if (!session) return { error: "未找到该小组" }
        return {
          groupName: session.groupName,
          status: session.status,
          messageCount: session.messages.length,
          messages: session.messages.map((m) => ({
            role: m.role,
            authorName: m.authorName,
            content: m.content,
            createdAt: m.createdAt,
          })),
        }
      }

      case "get_all_submissions": {
        const submissions = await prisma.submission.findMany({
          where: { currentLessonId: this.currentLessonId },
        })
        return submissions.map((s) => ({
          groupName: s.groupName,
          mainPoints: s.mainPoints,
          conclusions: s.conclusions,
          questions: s.questions,
        }))
      }

      default:
        return {}
    }
  }
}
