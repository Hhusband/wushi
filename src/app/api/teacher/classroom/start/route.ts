import { NextResponse } from "next/server"
import { verifyToken, extractToken } from "@/lib/auth"
import { currentLessonRepo } from "@/repositories/current-lesson"
import { ensureFirstRound } from "@/lib/rounds"

export async function POST(request: Request) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.teacherId) return NextResponse.json({ error: "未登录" }, { status: 401 })

    const { lessonId, grade, className, roundQuestion, roundRequirements, roundAllowSubmit } =
      await request.json()

    if (!lessonId || !grade || !className) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 })
    }

    const currentLesson = await currentLessonRepo.start({
      lessonId,
      teacherId: payload.teacherId as string,
      grade,
      className,
    })

    // V1.6：启动课堂即建立第 1 轮讨论（问题 = 课程核心问题），保持单轮课堂行为不变
    try {
      await ensureFirstRound(currentLesson.id, {
        question: typeof roundQuestion === "string" ? roundQuestion : undefined,
        requirements: typeof roundRequirements === "string" ? roundRequirements : undefined,
        allowSubmit: typeof roundAllowSubmit === "boolean" ? roundAllowSubmit : undefined,
      })
    } catch (err) {
      console.error("[rounds] ensureFirstRound failed:", err)
    }

    return NextResponse.json({ currentLesson })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
