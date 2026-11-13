import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken, extractToken } from "@/lib/auth"
import { publishRound, toRoundDTO } from "@/lib/rounds"
import { emitClassroomUpdate } from "@/lib/socket-server"

async function requireTeacher(request: Request, currentLessonId: string) {
  const token = extractToken(request)
  if (!token) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }
  const payload = await verifyToken(token)
  if (!payload?.teacherId) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }
  const cl = await prisma.currentLesson.findUnique({ where: { id: currentLessonId } })
  if (!cl) return { error: NextResponse.json({ error: "课堂不存在" }, { status: 404 }) }
  if (cl.teacherId !== (payload.teacherId as string)) {
    return { error: NextResponse.json({ error: "无权操作该课堂" }, { status: 403 }) }
  }
  return { cl }
}

/** GET /api/teacher/classroom/[currentLessonId]/rounds —— 轮次列表 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ currentLessonId: string }> }
) {
  const { currentLessonId } = await params
  const auth = await requireTeacher(request, currentLessonId)
  if ("error" in auth) return auth.error

  const rounds = await prisma.discussionRound.findMany({
    where: { currentLessonId },
    orderBy: { seq: "asc" },
  })

  const counts = await prisma.material.groupBy({
    by: ["roundId"],
    where: { currentLessonId, roundId: { not: null } },
    _count: { _all: true },
  })

  const countMap = new Map(counts.map((c) => [c.roundId as string, c._count._all]))

  return NextResponse.json({
    rounds: rounds.map((r) => ({ ...toRoundDTO(r), materialCount: countMap.get(r.id) || 0 })),
    activeRoundId: rounds.find((r) => r.status === "active")?.id || null,
  })
}

/** POST /api/teacher/classroom/[currentLessonId]/rounds —— 发布下一轮讨论 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ currentLessonId: string }> }
) {
  const { currentLessonId } = await params
  const auth = await requireTeacher(request, currentLessonId)
  if ("error" in auth) return auth.error

  const body = (await request.json().catch(() => ({}))) as {
    question?: string
    title?: string
    requirements?: string
    materialIds?: string[]
    allowSubmit?: boolean
  }

  try {
    const { round, sessionCount } = await publishRound({
      currentLessonId,
      question: body.question || "",
      title: body.title,
      requirements: body.requirements,
      materialIds: Array.isArray(body.materialIds) ? body.materialIds : [],
      allowSubmit: body.allowSubmit ?? true,
    })

    emitClassroomUpdate(currentLessonId, { type: "round_published", roundId: round.id, seq: round.seq })

    return NextResponse.json({ round: toRoundDTO(round), sessionCount })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "发布失败" }, { status: 400 })
  }
}
