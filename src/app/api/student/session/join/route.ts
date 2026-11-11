import { NextResponse } from "next/server"
import { currentLessonRepo } from "@/repositories/current-lesson"
import { sessionRepo } from "@/repositories/session"
import { messageRepo } from "@/repositories/message"
import { STUDENT_WELCOME_MESSAGE } from "@/prompts/student"

export async function POST(request: Request) {
  try {
    const { grade, className, groupNumber, groupName } = await request.json()

    if (!grade || !className || !groupNumber || !groupName) {
      return NextResponse.json({ error: "请填写完整的班级和小组信息" }, { status: 400 })
    }

    const currentLesson = await currentLessonRepo.findActive(grade, className)
    if (!currentLesson) {
      return NextResponse.json(
        { error: "当前没有进行中的课堂，请先联系老师启动课堂" },
        { status: 404 }
      )
    }

    // Find or create session
    let session = await sessionRepo.findByCurrentLessonAndGroup(
      currentLesson.id,
      Number(groupNumber)
    )

    if (!session) {
      session = await sessionRepo.create({
        currentLessonId: currentLesson.id,
        lessonId: currentLesson.lessonId,
        grade,
        className,
        groupNumber: Number(groupNumber),
        groupName,
      })

      // Send welcome message
      const welcomeMessage = STUDENT_WELCOME_MESSAGE
        .replace("{{groupName}}", groupName)
        .replace("{{lessonName}}", currentLesson.lesson.lessonName)
        .replace("{{coreQuestion}}", currentLesson.lesson.coreQuestion)

      await messageRepo.create({
        sessionId: session.id,
        role: "system",
        content: welcomeMessage,
        metadata: { type: "welcome" },
      })
    }

    // Get all messages
    const messages = await messageRepo.findBySessionId(session.id, 100)

    return NextResponse.json({
      session: {
        id: session.id,
        groupName: session.groupName,
        groupNumber: session.groupNumber,
        status: session.status,
      },
      lesson: {
        lessonName: currentLesson.lesson.lessonName,
        coreQuestion: currentLesson.lesson.coreQuestion,
        followUpQuestions: currentLesson.lesson.followUpQuestions,
        discussionRequirements: currentLesson.lesson.discussionRequirements,
      },
      messages,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
