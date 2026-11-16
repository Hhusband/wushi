import { NextResponse } from "next/server"
import { DiscussionManager } from "@/services/discussion/manager"
import { emitSessionUpdate, emitClassroomUpdate } from "@/lib/socket-server"
import { prisma } from "@/lib/prisma"
import { exportSessionToExcel } from "@/services/export/excel-exporter"
import { getActiveRound } from "@/lib/rounds"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const sessionBefore = await prisma.studentSession.findUnique({
      where: { id },
    })
    // 提交前先判断：老师是否已经发布了新一轮（学生提交的是上一轮）
    // 若是，提交后保持会话可继续讨论，不把学生卡在「已提交」
    let keepActive = false
    if (sessionBefore?.currentLessonId) {
      const activeRound = await getActiveRound(sessionBefore.currentLessonId).catch(() => null)
      if (activeRound) {
        const lastStudentMessage = await prisma.message.findFirst({
          where: { sessionId: id, role: "student", roundId: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { roundId: true },
        })
        if (lastStudentMessage?.roundId && lastStudentMessage.roundId !== activeRound.id) {
          keepActive = true
        }
      }
    }

    const manager = new DiscussionManager(id)
    await manager.confirmSubmission()

    let session = await prisma.studentSession.findUnique({ where: { id } })
    if (keepActive && session) {
      session = await prisma.studentSession.update({
        where: { id },
        data: { status: "active" },
      })
    }
    if (session?.currentLessonId) {
      emitSessionUpdate(id, {
        sessionId: id,
        status: session.status,
        currentLessonId: session.currentLessonId,
      })
      emitClassroomUpdate(session.currentLessonId, { type: "submission", sessionId: id })
    }

    exportSessionToExcel(id).catch((err) =>
      console.error("[export] submit export failed:", err)
    )

    return NextResponse.json({ success: true, message: "提交成功！" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
