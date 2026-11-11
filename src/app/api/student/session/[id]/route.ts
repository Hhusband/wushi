import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await prisma.studentSession.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      lesson: true,
    },
  })
  if (!session) return NextResponse.json({ error: "会话不存在" }, { status: 404 })

  const { messages, lesson, ...sessionData } = session

  return NextResponse.json({
    session: sessionData,
    messages,
    lesson: {
      lessonName: lesson.lessonName,
      coreQuestion: lesson.coreQuestion,
      followUpQuestions: lesson.followUpQuestions,
      discussionRequirements: lesson.discussionRequirements,
    },
  })
}
