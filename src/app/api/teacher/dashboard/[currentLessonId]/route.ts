import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ currentLessonId: string }> }
) {
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

  const totalMessages = await prisma.message.count({
    where: { session: { currentLessonId } },
  })

  // Build dashboard sessions data
  const dashboardSessions = await Promise.all(
    sessions.map(async (s) => {
      const messageCount = await prisma.message.count({ where: { sessionId: s.id } })
      const lastMessage = await prisma.message.findFirst({
        where: { sessionId: s.id },
        orderBy: { createdAt: "desc" },
      })

      return {
        id: s.id,
        groupName: s.groupName,
        groupNumber: s.groupNumber,
        status: s.status,
        messageCount,
        lastActiveAt: lastMessage?.createdAt?.toISOString() || s.updatedAt.toISOString(),
        depthScore: Math.min(Math.round((messageCount / Math.max(totalMessages || 1, 1)) * 100), 100),
      }
    })
  )

  // Simple keyword extraction from messages (placeholder for NLP)
  const allMessages = await prisma.message.findMany({
    where: { session: { currentLessonId } },
    select: { content: true },
    take: 500,
  })

  const keywordCloud = extractKeywords(allMessages.map((m) => m.content))

  return NextResponse.json({
    currentLesson,
    lesson: currentLesson.lesson,
    totalGroups: sessions.length,
    submittedGroups: submissions.length,
    activeGroups: sessions.filter((s) => s.status === "active").length,
    sessions: dashboardSessions,
    keywordCloud,
    opinionDistribution: [],
    activeGroupsRanking: dashboardSessions
      .sort((a, b) => b.messageCount - a.messageCount)
      .map((s) => ({ groupName: s.groupName, messageCount: s.messageCount })),
  })
}

function extractKeywords(messages: string[]): { word: string; count: number }[] {
  // Simple keyword extraction — full NLP would use jieba or similar
  const wordCount: Record<string, number> = {}
  const allText = messages.join(" ")

  // Extract 2-4 character Chinese phrases
  const matches = allText.match(/[一-龥]{2,4}/g) || []
  const stopWords = new Set([
    "这个", "那个", "我们", "他们", "因为", "所以", "但是", "虽然",
    "可以", "不是", "什么", "怎么", "为什么", "一个", "这样", "那样",
    "我觉得", "我认为", "就是", "大家", "还有", "而且", "不过",
  ])

  for (const word of matches) {
    if (stopWords.has(word)) continue
    wordCount[word] = (wordCount[word] || 0) + 1
  }

  return Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }))
}
