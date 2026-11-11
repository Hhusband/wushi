import { StudentAgent } from "@/agents/student-agent"
import { prisma } from "@/lib/prisma"
import { STUDENT_WELCOME_MESSAGE } from "@/prompts/student"
import { SUBJECT_GUIDANCE } from "@/lib/constants"
import type { ChatMessage, MessageData } from "@/types"

export class DiscussionManager {
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async getOrCreateAgent(): Promise<StudentAgent> {
    const session = await prisma.studentSession.findUnique({
      where: { id: this.sessionId },
      include: { lesson: true },
    })
    if (!session) throw new Error("会话不存在")

    const subject = session.lesson.subject || "语文"

    return new StudentAgent(this.sessionId, {
      subject,
      grade: session.grade,
      className: session.className,
      groupName: session.groupName,
      lessonName: session.lesson.lessonName,
      coreQuestion: session.lesson.coreQuestion,
      followUpQuestions: session.lesson.followUpQuestions as string[],
      discussionRequirements: session.lesson.discussionRequirements,
    })
  }

  async handleMessage(
    content: string,
    authorName?: string
  ): Promise<{ userMessage: MessageData; aiResponse: MessageData; autoSubmitted?: boolean }> {
    const agent = await this.getOrCreateAgent()
    const session = await prisma.studentSession.findUnique({
      where: { id: this.sessionId },
    })
    if (!session) throw new Error("会话不存在")

    // Get recent history
    const recentMessages = await prisma.message.findMany({
      where: { sessionId: this.sessionId },
      orderBy: { createdAt: "asc" },
      take: 40,
    })

    const history: ChatMessage[] = recentMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.role === "student" ? `[${m.authorName || "学生"}] ${m.content}` : m.content,
    }))

    // Send to student agent
    const response = await agent.discuss(content, authorName, history)

    // Get the saved user message (last student message)
    const userMessage = await prisma.message.findFirst({
      where: { sessionId: this.sessionId, role: "student" },
      orderBy: { createdAt: "desc" },
    })

    // Save AI response
    const aiMessage = await prisma.message.create({
      data: {
        sessionId: this.sessionId,
        role: "assistant",
        content: response.content,
        metadata: (response.data || {}) as any,
      },
    })

    // Log agent action
    await agent.logAction(
      "student",
      "discuss",
      content,
      response.content,
      response.data ? JSON.stringify(response.data).length : 0,
      this.sessionId,
      session.lessonId
    )

    // Auto-submit if AI generated a summary (discussion ended)
    let autoSubmitted = false
    if (response.content.includes("【讨论总结】")) {
      autoSubmitted = true
      try {
        await this.confirmSubmission()
      } catch {
        // If auto-submit fails, the student can still manually submit
        autoSubmitted = false
      }
    }

    return {
      userMessage: userMessage as unknown as MessageData,
      aiResponse: aiMessage as unknown as MessageData,
      autoSubmitted,
    }
  }

  async generateWelcomeMessage(): Promise<string> {
    const session = await prisma.studentSession.findUnique({
      where: { id: this.sessionId },
      include: { lesson: true },
    })
    if (!session) throw new Error("会话不存在")

    const subject = session.lesson.subject || "语文"
    const guidance = SUBJECT_GUIDANCE[subject] || SUBJECT_GUIDANCE["语文"]

    return STUDENT_WELCOME_MESSAGE
      .replace("{{groupName}}", session.groupName)
      .replace("{{lessonName}}", session.lesson.lessonName)
      .replace("{{coreQuestion}}", session.lesson.coreQuestion)
      .replace("{{subject}}", subject)
      .replace("{{welcomeHint}}", guidance.welcomeHint)
  }

  async generateSummary(): Promise<{ summary: MessageData }> {
    const agent = await this.getOrCreateAgent()
    const session = await prisma.studentSession.findUnique({
      where: { id: this.sessionId },
    })
    if (!session) throw new Error("会话不存在")

    // Update session status
    await prisma.studentSession.update({
      where: { id: this.sessionId },
      data: { status: "summarizing" },
    })

    // Generate summary via agent
    const response = await agent.chat(
      "请为我们的讨论生成总结。",
      [],
      "现在讨论已经结束，请为小组的讨论做一个完整的总结，包括主要观点、依据、结论和疑问。以'【讨论总结】'开头。"
    )

    const summaryMessage = await prisma.message.create({
      data: {
        sessionId: this.sessionId,
        role: "assistant",
        content: response.content,
        metadata: { type: "summary" },
      },
    })

    return { summary: summaryMessage as unknown as MessageData }
  }

  async confirmSubmission(): Promise<void> {
    const session = await prisma.studentSession.findUnique({
      where: { id: this.sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })
    if (!session) throw new Error("会话不存在")

    // Find the summary - either a dedicated summary message or the last assistant message with summary content
    const summaryMessages = session.messages.filter(
      (m) =>
        m.role === "assistant" &&
        ((m.metadata as Record<string, unknown>)?.type === "summary" ||
          m.content.includes("讨论总结"))
    )
    const summaryContent =
      summaryMessages.length > 0
        ? summaryMessages.map((m) => m.content).join("\n")
        : session.messages
            .filter((m) => m.role === "assistant")
            .slice(-3)
            .map((m) => m.content)
            .join("\n")

    // Create submission
    const mainPointsText = this.extractSection(summaryContent, ["主要观点", "主要发现"])
    const evidenceText = this.extractSection(summaryContent, ["依据", "证据", "依据与证据"])
    const conclusionsText = this.extractSection(summaryContent, ["结论", "小组结论"])
    const questionsText = this.extractSection(summaryContent, ["疑问", "问题", "遗留问题"])

    await prisma.submission.create({
      data: {
        sessionId: this.sessionId,
        lessonId: session.lessonId,
        currentLessonId: session.currentLessonId,
        groupName: session.groupName,
        mainPoints: this.toArray(mainPointsText) as any,
        evidence: this.toArray(evidenceText) as any,
        conclusions: conclusionsText,
        questions: questionsText,
      },
    })

    // Update session status
    await prisma.studentSession.update({
      where: { id: this.sessionId },
      data: { status: "submitted" },
    })
  }

  private extractSection(text: string, sectionNames: string[]): string {
    // Match formats like "一、主要观点" or "主要观点：" with content until the next numbered header
    // Sort by length descending so longer patterns match before shorter ones
    const sorted = [...sectionNames].sort((a, b) => b.length - a.length)
    const pattern = sorted
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")
    const regex = new RegExp(
      `(?:[一二三四五六七八九]、)?(?:${pattern})[：:]?\\s*([\\s\\S]*?)(?=\\n(?:[一二三四五六七八九]、|[#【])|$)`,
      "m"
    )
    const match = text.match(regex)
    return match?.[1]?.trim() || ""
  }

  private toArray(text: string): string[] {
    const lines = text
      .split(/\n/)
      .map((l) => l.replace(/^[-\s\d.、]+/, "").trim())
      .filter((l) => l.length > 0)
    return lines.length > 0 ? lines : text ? [text] : []
  }
}
