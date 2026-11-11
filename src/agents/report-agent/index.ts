import { chat } from "@/services/llm/client"
import { REPORT_AGENT_PROMPT } from "@/prompts/report"
import { prisma } from "@/lib/prisma"
import type { ReportData } from "@/types"

export class ReportAgent {
  private currentLessonId: string

  constructor(currentLessonId: string) {
    this.currentLessonId = currentLessonId
  }

  async generate(): Promise<ReportData> {
    const currentLesson = await prisma.currentLesson.findUnique({
      where: { id: this.currentLessonId },
      include: { lesson: true },
    })
    if (!currentLesson) throw new Error("课堂不存在")

    const sessions = await prisma.studentSession.findMany({
      where: { currentLessonId: this.currentLessonId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })

    const submissions = await prisma.submission.findMany({
      where: { currentLessonId: this.currentLessonId },
    })

    // Build analysis data
    const sessionData = sessions.map((s) => ({
      groupName: s.groupName,
      status: s.status,
      messageCount: s.messages.length,
      messages: s.messages.map((m) =>
        `[${m.role}${m.authorName ? ` - ${m.authorName}` : ""}] ${m.content}`
      ).join("\n"),
    }))

    const submissionData = submissions.map((s) => ({
      groupName: s.groupName,
      mainPoints: JSON.stringify(s.mainPoints),
      evidence: JSON.stringify(s.evidence),
      conclusions: s.conclusions,
      questions: s.questions,
    }))

    const subject = currentLesson.lesson.subject || "语文"

    const prompt = REPORT_AGENT_PROMPT
      .replace("{{grade}}", currentLesson.grade)
      .replace("{{className}}", currentLesson.className)
      .replace("{{lessonName}}", currentLesson.lesson.lessonName)
      .replace("{{coreQuestion}}", currentLesson.lesson.coreQuestion)
      .replace(/{{subject}}/g, subject)

    const userMessage = `
## 各小组讨论数据

${sessionData.map((s) => `
### ${s.groupName}
状态: ${s.status} | 消息数: ${s.messageCount}
讨论记录:
${s.messages.slice(0, 3000)}
`).join("\n---\n")}

## 各组提交成果

${submissionData.map((s) => `
### ${s.groupName}
主要观点: ${s.mainPoints}
证据: ${s.evidence}
结论: ${s.conclusions}
疑问: ${s.questions}
`).join("\n---\n")}

请根据以上数据，按照要求的JSON格式生成课堂分析报告。
`

    const res = await chat(
      [
        { role: "system", content: prompt },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.5, maxTokens: 4096 }
    )

    // Parse JSON response
    let report: ReportData
    try {
      const jsonStr = res.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const parsed = JSON.parse(jsonStr)

      report = {
        id: "",
        lessonId: currentLesson.lessonId,
        currentLessonId: this.currentLessonId,
        overallSummary: parsed.overallSummary || "",
        topGroups: parsed.topGroups || [],
        strugglingGroups: parsed.strugglingGroups || [],
        commonMisconceptions: parsed.commonMisconceptions || [],
        teachingSuggestions: parsed.teachingSuggestions || "",
        followUpQuestions: parsed.followUpQuestions || [],
        boardSuggestions: parsed.boardSuggestions || "",
        homeworkSuggestions: parsed.homeworkSuggestions || "",
        keywordCloud: parsed.keywordCloud || [],
        opinionDistribution: parsed.opinionDistribution || [],
        discussionDepthScores: parsed.discussionDepthScores || [],
        createdAt: new Date().toISOString(),
      }
    } catch {
      // Fallback: structured from raw text
      report = {
        id: "",
        lessonId: currentLesson.lessonId,
        currentLessonId: this.currentLessonId,
        overallSummary: res.content,
        topGroups: [],
        strugglingGroups: [],
        commonMisconceptions: [],
        teachingSuggestions: "",
        followUpQuestions: [],
        boardSuggestions: "",
        homeworkSuggestions: "",
        keywordCloud: [],
        opinionDistribution: [],
        discussionDepthScores: [],
        createdAt: new Date().toISOString(),
      }
    }

    // Save to database
    const saved = await prisma.lessonReport.create({
      data: {
        lessonId: report.lessonId,
        currentLessonId: report.currentLessonId,
        overallSummary: report.overallSummary,
        topGroups: report.topGroups,
        strugglingGroups: report.strugglingGroups,
        commonMisconceptions: report.commonMisconceptions,
        teachingSuggestions: report.teachingSuggestions,
        followUpQuestions: report.followUpQuestions,
        boardSuggestions: report.boardSuggestions,
        homeworkSuggestions: report.homeworkSuggestions,
        keywordCloud: report.keywordCloud,
        opinionDistribution: report.opinionDistribution,
        discussionDepthScores: report.discussionDepthScores,
      },
    })

    report.id = saved.id
    return report
  }
}
