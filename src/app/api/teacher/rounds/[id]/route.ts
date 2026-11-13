import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken, extractToken } from "@/lib/auth"
import { endRound, toRoundDTO, updateRound } from "@/lib/rounds"
import { emitClassroomUpdate } from "@/lib/socket-server"

async function requireTeacher(request: Request, roundId: string) {
  const token = extractToken(request)
  if (!token) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }
  const payload = await verifyToken(token)
  if (!payload?.teacherId) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }

  const round = await prisma.discussionRound.findUnique({
    where: { id: roundId },
    include: { currentLesson: true },
  })
  if (!round) return { error: NextResponse.json({ error: "轮次不存在" }, { status: 404 }) }
  if (round.currentLesson.teacherId !== (payload.teacherId as string)) {
    return { error: NextResponse.json({ error: "无权操作该轮次" }, { status: 403 }) }
  }
  return { round }
}

/** GET /api/teacher/rounds/[id] —— 轮次详情（含资料） */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireTeacher(request, id)
  if ("error" in auth) return auth.error

  const materials = await prisma.material.findMany({
    where: { roundId: id },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json({ round: toRoundDTO(auth.round), materials })
}

/** PATCH /api/teacher/rounds/[id] —— 修改本轮设置 / 结束本轮 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireTeacher(request, id)
  if ("error" in auth) return auth.error

  const body = (await request.json().catch(() => ({}))) as {
    allowSubmit?: boolean
    title?: string
    question?: string
    requirements?: string
    ended?: boolean
  }

  try {
    if (body.ended === true) {
      const round = await endRound(id)
      emitClassroomUpdate(round.currentLessonId, { type: "round_ended", roundId: round.id })
      return NextResponse.json({ round: toRoundDTO(round) })
    }

    const round = await updateRound(id, {
      allowSubmit: body.allowSubmit,
      title: body.title,
      question: body.question,
      requirements: body.requirements,
    })
    emitClassroomUpdate(round.currentLessonId, { type: "round_updated", roundId: round.id })
    return NextResponse.json({ round: toRoundDTO(round) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "更新失败" }, { status: 400 })
  }
}
