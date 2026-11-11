import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatSimple } from "@/services/llm/client"
import { BRIEFING_PROMPT } from "@/prompts/teacher"
import { SUBJECT_GUIDANCE } from "@/lib/constants"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ currentLessonId: string }> }
) {
  try {
    const { currentLessonId } = await params

    const currentLesson = await prisma.currentLesson.findUnique({
      where: { id: currentLessonId },
      include: { lesson: true },
    })
    if (!currentLesson) return NextResponse.json({ error: "课堂不存在" }, { status: 404 })

    const sessions = await prisma.studentSession.findMany({
      where: { currentLessonId },
      orderBy: { groupNumber: "asc" },
    })

    const submissions = await prisma.submission.findMany({
      where: { currentLessonId },
    })

    // Collect all messages grouped by session
    const sessionData = await Promise.all(
      sessions.map(async (s) => {
        const messages = await prisma.message.findMany({
          where: { sessionId: s.id },
          orderBy: { createdAt: "asc" },
        })
        const submission = submissions.find((sub) => sub.sessionId === s.id)

        return {
          groupName: s.groupName,
          groupNumber: s.groupNumber,
          status: s.status,
          messageCount: messages.length,
          studentMessages: messages
            .filter((m) => m.role === "student")
            .map((m) => `[${m.authorName || "学生"}] ${m.content}`),
          aiMessages: messages
            .filter((m) => m.role === "assistant")
            .map((m) => m.content.slice(0, 200)),
          submission: submission
            ? {
                mainPoints: submission.mainPoints,
                conclusions: submission.conclusions,
                questions: submission.questions,
              }
            : null,
        }
      })
    )

    const subject = currentLesson.lesson.subject || "语文"
    const guidance = SUBJECT_GUIDANCE[subject] || SUBJECT_GUIDANCE["语文"]
    const systemPrompt = BRIEFING_PROMPT
      .replace("{{teacherRole}}", guidance.role)
      .replace("{{subject}}", subject)

    // Build context for the AI
    const contextData = `
学科: ${subject}
课堂: ${currentLesson.grade}${currentLesson.className}
课题: ${currentLesson.lesson.lessonName}
核心问题: ${currentLesson.lesson.coreQuestion}
小组总数: ${sessions.length}
已提交: ${submissions.length}
讨论中: ${sessions.filter((s) => s.status === "active").length}

各小组数据:
${sessionData.map((s) => `
【${s.groupName}】(第${s.groupNumber}组) 状态: ${s.status} 消息数: ${s.messageCount}
学生发言:
${s.studentMessages.map((m) => `  ${m}`).join("\n") || "  (暂无)"}
${s.submission ? `提交成果: ${JSON.stringify(s.submission)}` : "未提交"}
`).join("\n")}
`

    const report = await chatSimple(systemPrompt, contextData, {
      temperature: 0.5,
      maxTokens: 800,
    })

    return NextResponse.json({ report, sessionData })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
