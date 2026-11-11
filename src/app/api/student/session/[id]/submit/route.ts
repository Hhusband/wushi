import { NextResponse } from "next/server"
import { DiscussionManager } from "@/services/discussion/manager"
import { emitSessionUpdate, emitClassroomUpdate } from "@/lib/socket-server"
import { prisma } from "@/lib/prisma"
import { exportSessionToExcel } from "@/services/export/excel-exporter"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const manager = new DiscussionManager(id)
    await manager.confirmSubmission()

    const session = await prisma.studentSession.findUnique({
      where: { id },
    })
    if (session?.currentLessonId) {
      emitSessionUpdate(id, {
        sessionId: id,
        status: "submitted",
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
