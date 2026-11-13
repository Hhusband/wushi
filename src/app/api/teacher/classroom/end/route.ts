import { NextResponse } from "next/server"
import { verifyToken, extractToken } from "@/lib/auth"
import { currentLessonRepo } from "@/repositories/current-lesson"
import { exportClassroomToExcel } from "@/services/export/excel-exporter"
import { cleanupLessonMaterials } from "@/lib/rounds"

export async function POST(request: Request) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.teacherId) return NextResponse.json({ error: "未登录" }, { status: 401 })

    const { currentLessonId } = await request.json()
    const currentLesson = await currentLessonRepo.end(currentLessonId)

    // V1.6：课堂结束即清除本节上传的资料（数据库记录 + uploads 文件）
    let clearedMaterials = 0
    try {
      clearedMaterials = await cleanupLessonMaterials(currentLessonId)
    } catch (err) {
      console.error("[rounds] cleanup materials failed:", err)
    }

    // Fire-and-forget: export runs after response without blocking
    exportClassroomToExcel(currentLessonId).catch((err) =>
      console.error("[export] classroom end export failed:", err)
    )

    return NextResponse.json({ currentLesson, clearedMaterials })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
