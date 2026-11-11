import { prisma } from "@/lib/prisma"

export const sessionRepo = {
  async findById(id: string) {
    return prisma.studentSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })
  },

  async findByCurrentLessonAndGroup(currentLessonId: string, groupNumber: number) {
    return prisma.studentSession.findUnique({
      where: { currentLessonId_groupNumber: { currentLessonId, groupNumber } },
    })
  },

  async create(data: {
    currentLessonId: string
    lessonId: string
    grade: string
    className: string
    groupNumber: number
    groupName: string
  }) {
    return prisma.studentSession.create({
      data: {
        currentLessonId: data.currentLessonId,
        lessonId: data.lessonId,
        grade: data.grade,
        className: data.className,
        groupNumber: data.groupNumber,
        groupName: data.groupName,
        status: "active",
      },
    })
  },

  async updateStatus(id: string, status: string) {
    return prisma.studentSession.update({
      where: { id },
      data: { status },
    })
  },

  async findAllByCurrentLesson(currentLessonId: string) {
    return prisma.studentSession.findMany({
      where: { currentLessonId },
      orderBy: { groupNumber: "asc" },
    })
  },

  async getMessageCount(sessionId: string) {
    return prisma.message.count({ where: { sessionId } })
  },
}
