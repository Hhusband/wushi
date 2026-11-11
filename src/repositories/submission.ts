import { prisma } from "@/lib/prisma"

export const submissionRepo = {
  async findBySessionId(sessionId: string) {
    return prisma.submission.findUnique({ where: { sessionId } })
  },

  async create(data: {
    sessionId: string
    lessonId: string
    currentLessonId: string
    groupName: string
    mainPoints: unknown
    evidence: unknown
    conclusions: string
    questions: string
  }) {
    return prisma.submission.create({
      data: {
        sessionId: data.sessionId,
        lessonId: data.lessonId,
        currentLessonId: data.currentLessonId,
        groupName: data.groupName,
        mainPoints: data.mainPoints as any,
        evidence: data.evidence as any,
        conclusions: data.conclusions,
        questions: data.questions,
      },
    })
  },

  async findAllByCurrentLesson(currentLessonId: string) {
    return prisma.submission.findMany({
      where: { currentLessonId },
    })
  },
}
