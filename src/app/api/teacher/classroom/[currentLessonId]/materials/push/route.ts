import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken, extractToken } from "@/lib/auth"
import { emitClassroomUpdate } from "@/lib/socket-server"

/** POST /api/teacher/classroom/[currentLessonId]/materials/push —— 下发 / 撤回资料 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ currentLessonId: string }> }
) {
  const { currentLessonId } = await params

  const token = extractToken(request)
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload?.teacherId) return NextResponse.json({ error: "未登录" }, { status: 401 })

  const cl = await prisma.currentLesson.findUnique({ where: { id: currentLessonId } })
  if (!cl) return NextResponse.json({ error: "课堂不存在" }, { status: 404 })
  if (cl.teacherId !== (payload.teacherId as string)) {
    return NextResponse.json({ error: "无权操作该课堂" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    materialIds?: string[]
    all?: boolean
    roundId?: string
    unpush?: boolean
  }

  const ids = Array.isArray(body.materialIds) ? body.materialIds.filter(Boolean) : []
  if (!body.all && ids.length === 0) {
    return NextResponse.json({ error: "请选择要下发的资料" }, { status: 400 })
  }

  const where = body.all
    ? { currentLessonId }
    : { currentLessonId, id: { in: ids } }

  const data: Record<string, unknown> = body.unpush
    ? { pushedAt: null }
    : { pushedAt: new Date() }

  if (!body.unpush && body.roundId) {
    const round = await prisma.discussionRound.findFirst({
      where: { id: body.roundId, currentLessonId },
      select: { id: true },
    })
    if (!round) return NextResponse.json({ error: "轮次不存在" }, { status: 400 })
    data.roundId = round.id
  }

  const result = await prisma.material.updateMany({ where, data })
  emitClassroomUpdate(currentLessonId, { type: "materials_changed" })

  return NextResponse.json({ updated: result.count })
}
