import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureFirstRound, toRoundDTO } from "@/lib/rounds"
import { toMaterialDTO } from "@/lib/uploads"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await prisma.studentSession.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      lesson: true,
      currentLesson: { select: { id: true, status: true } },
    },
  })
  if (!session) return NextResponse.json({ error: "会话不存在" }, { status: 404 })

  const { messages, lesson, currentLesson, ...sessionData } = session

  // 轮次：旧数据可能还没有轮次，这里补建第 1 轮保证兼容
  // 课堂结束后不再补建
  let rounds = await prisma.discussionRound.findMany({
    where: { currentLessonId: session.currentLessonId },
    orderBy: { seq: "asc" },
  })
  if (rounds.length === 0 && currentLesson?.status === "active") {
    try {
      await ensureFirstRound(session.currentLessonId)
      rounds = await prisma.discussionRound.findMany({
        where: { currentLessonId: session.currentLessonId },
        orderBy: { seq: "asc" },
      })
    } catch {
      // 忽略：补建失败不影响主流程
    }
  }

  const materials = await prisma.material.findMany({
    where: { currentLessonId: session.currentLessonId, pushedAt: { not: null } },
    orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }],
  })

  const activeRound = rounds.find((r) => r.status === "active") || null

  return NextResponse.json({
    session: sessionData,
    messages,
    lesson: {
      lessonName: lesson.lessonName,
      coreQuestion: lesson.coreQuestion,
      followUpQuestions: lesson.followUpQuestions,
      discussionRequirements: lesson.discussionRequirements,
    },
    rounds: rounds.map(toRoundDTO),
    activeRoundId: activeRound?.id || null,
    materials: materials.map(toMaterialDTO),
    currentLessonStatus: currentLesson?.status || null,
  })
}
