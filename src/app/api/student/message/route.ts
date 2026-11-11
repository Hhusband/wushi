import { NextResponse } from "next/server"
import { DiscussionManager } from "@/services/discussion/manager"
import { emitNewMessage, emitSessionUpdate, emitClassroomUpdate } from "@/lib/socket-server"
import { prisma } from "@/lib/prisma"
import { debouncedExport } from "@/services/export/debounce"

export async function POST(request: Request) {
  try {
    const { sessionId, content, authorName } = await request.json()

    if (!sessionId || !content) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 })
    }

    const manager = new DiscussionManager(sessionId)
    const result = await manager.handleMessage(content, authorName)

    // Emit real-time events
    emitNewMessage(sessionId, {
      id: (result.aiResponse as any).id,
      sessionId,
      role: "assistant",
      content: result.aiResponse.content,
      createdAt: (result.aiResponse as any).createdAt,
    })

    const session = await prisma.studentSession.findUnique({
      where: { id: sessionId },
    })
    if (session?.currentLessonId) {
      emitSessionUpdate(sessionId, {
        sessionId,
        status: session.status,
        currentLessonId: session.currentLessonId,
      })
      emitClassroomUpdate(session.currentLessonId, { type: "message", sessionId })
    }

    debouncedExport(sessionId)

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
