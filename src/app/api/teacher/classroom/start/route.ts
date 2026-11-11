import { NextResponse } from "next/server"
import { verifyToken, extractToken } from "@/lib/auth"
import { currentLessonRepo } from "@/repositories/current-lesson"

export async function POST(request: Request) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.teacherId) return NextResponse.json({ error: "未登录" }, { status: 401 })

    const { lessonId, grade, className } = await request.json()

    if (!lessonId || !grade || !className) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 })
    }

    const currentLesson = await currentLessonRepo.start({
      lessonId,
      teacherId: payload.teacherId as string,
      grade,
      className,
    })

    return NextResponse.json({ currentLesson })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
