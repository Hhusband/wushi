import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toRoundDTO, ensureFirstRound } from "@/lib/rounds"
import { toMaterialDTO } from "@/lib/uploads"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ currentLessonId: string }> }
) {
  const { currentLessonId } = await params
  const roundIdParam = new URL(request.url).searchParams.get("roundId")

  const currentLesson = await prisma.currentLesson.findUnique({
    where: { id: currentLessonId },
    include: { lesson: true },
  })
  if (!currentLesson) return NextResponse.json({ error: "课堂不存在" }, { status: 404 })

  // 本次升级前启动的课堂（或历史遗留的 active 课堂）还没有轮次记录：
  // 懒补建第 1 轮，保证教师端轮次时间线与学生端一致。
  if (currentLesson.status === "active") {
    await ensureFirstRound(currentLessonId).catch(() => null)
  }

  const sessions = await prisma.studentSession.findMany({
    where: { currentLessonId },
    orderBy: { groupNumber: "asc" },
  })

  const submissions = await prisma.submission.findMany({
    where: { currentLessonId },
  })

  const rounds = await prisma.discussionRound.findMany({
    where: { currentLessonId },
    orderBy: { seq: "asc" },
  })
  const activeRound = rounds.find((r) => r.status === "active") || null

  const materials = await prisma.material.findMany({
    where: { currentLessonId },
    orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }],
  })

  // 轮次筛选：不传 roundId 时统计整节课；传 "active" 时统计当前轮
  let filterRoundId: string | null = null
  if (roundIdParam === "active") filterRoundId = activeRound?.id || null
  else if (roundIdParam) filterRoundId = roundIdParam

  const messageWhere = {
    session: { currentLessonId },
    ...(filterRoundId ? { roundId: filterRoundId } : {}),
  }

  const totalMessages = await prisma.message.count({ where: messageWhere })

  const perRoundCounts = await prisma.message.groupBy({
    by: ["roundId"],
    where: { session: { currentLessonId } },
    _count: { _all: true },
  })
  const perRoundCountMap = new Map(perRoundCounts.map((c) => [c.roundId || "", c._count._all]))

  const materialCountByRound = new Map<string, number>()
  for (const m of materials) {
    if (m.roundId) materialCountByRound.set(m.roundId, (materialCountByRound.get(m.roundId) || 0) + 1)
  }

  // Build dashboard sessions data
  const dashboardSessions = await Promise.all(
    sessions.map(async (s) => {
      const messageCount = await prisma.message.count({
        where: { sessionId: s.id, ...(filterRoundId ? { roundId: filterRoundId } : {}) },
      })
      const lastMessage = await prisma.message.findFirst({
        where: { sessionId: s.id, ...(filterRoundId ? { roundId: filterRoundId } : {}) },
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
    where: messageWhere,
    select: { content: true },
    take: 500,
  })

  const keywordCloud = extractKeywords(allMessages.map((m) => m.content))

  const canSubmit = filterRoundId
    ? rounds.find((r) => r.id === filterRoundId)?.allowSubmit ?? true
    : activeRound?.allowSubmit ?? true

  return NextResponse.json({
    currentLesson,
    lesson: currentLesson.lesson,
    totalGroups: sessions.length,
    submittedGroups: submissions.length,
    activeGroups: sessions.filter((s) => s.status === "active").length,
    sessions: dashboardSessions,
    keywordCloud,
    opinionDistribution: [],
    activeGroupsRanking: [...dashboardSessions]
      .sort((a, b) => b.messageCount - a.messageCount)
      .map((s) => ({ groupName: s.groupName, messageCount: s.messageCount })),
    // V1.6 分轮讨论 + 资料
    rounds: rounds.map((r) => ({
      ...toRoundDTO(r),
      messageCount: perRoundCountMap.get(r.id) || 0,
      materialCount: materialCountByRound.get(r.id) || 0,
    })),
    activeRoundId: activeRound?.id || null,
    filterRoundId,
    allowSubmit: canSubmit,
    materials: materials.map(toMaterialDTO),
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
