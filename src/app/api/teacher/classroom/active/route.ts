import { NextResponse } from "next/server"
import { verifyToken, extractToken } from "@/lib/auth"
import { currentLessonRepo } from "@/repositories/current-lesson"

export async function GET(request: Request) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.teacherId) return NextResponse.json({ error: "未登录" }, { status: 401 })

    const currentLesson = await currentLessonRepo.getTeacherActive(payload.teacherId as string)
    return NextResponse.json({ currentLesson })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}
