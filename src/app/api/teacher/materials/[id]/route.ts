import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken, extractToken } from "@/lib/auth"
import { removeStoredFile, toMaterialDTO } from "@/lib/uploads"
import { emitClassroomUpdate } from "@/lib/socket-server"

async function requireTeacher(request: Request) {
  const token = extractToken(request)
  if (!token) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }
  const payload = await verifyToken(token)
  if (!payload?.teacherId) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }
  return { teacherId: payload.teacherId as string }
}

async function loadMaterial(id: string) {
  return prisma.material.findUnique({
    where: { id },
    include: { currentLesson: true },
  })
}

/** PATCH /api/teacher/materials/[id] —— 改标题、改轮次、下发/撤回 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireTeacher(request)
  if ("error" in auth) return auth.error

  const material = await loadMaterial(id)
  if (!material) return NextResponse.json({ error: "资料不存在" }, { status: 404 })
  if (material.currentLesson.teacherId !== auth.teacherId) {
    return NextResponse.json({ error: "无权操作该资料" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    roundId?: string | null
    push?: boolean
    unpush?: boolean
  }

  const data: Record<string, unknown> = {}

  if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 200)

  if (body.roundId !== undefined) {
    if (body.roundId === null || body.roundId === "") {
      data.roundId = null
    } else {
      const round = await prisma.discussionRound.findFirst({
        where: { id: body.roundId, currentLessonId: material.currentLessonId },
        select: { id: true },
      })
      if (!round) return NextResponse.json({ error: "轮次不存在" }, { status: 400 })
      data.roundId = round.id
    }
  }

  if (body.push === true) {
    data.pushedAt = new Date()
    if (!data.roundId && !material.roundId) {
      const active = await prisma.discussionRound.findFirst({
        where: { currentLessonId: material.currentLessonId, status: "active" },
        orderBy: { seq: "desc" },
        select: { id: true },
      })
      if (active) data.roundId = active.id
    }
  }
  if (body.unpush === true) data.pushedAt = null

  const updated = await prisma.material.update({ where: { id }, data })
  emitClassroomUpdate(material.currentLessonId, { type: "materials_changed" })
  return NextResponse.json({ material: toMaterialDTO(updated) })
}

/** DELETE /api/teacher/materials/[id] —— 删除资料（记录 + 文件） */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireTeacher(request)
  if ("error" in auth) return auth.error

  const material = await loadMaterial(id)
  if (!material) return NextResponse.json({ error: "资料不存在" }, { status: 404 })
  if (material.currentLesson.teacherId !== auth.teacherId) {
    return NextResponse.json({ error: "无权操作该资料" }, { status: 403 })
  }

  await prisma.material.delete({ where: { id } })
  await removeStoredFile(material.currentLessonId, material.storedName)
  emitClassroomUpdate(material.currentLessonId, { type: "materials_changed" })

  return NextResponse.json({ ok: true })
}
