import { prisma } from "@/lib/prisma"

export const reportRepo = {
  async findById(id: string) {
    return prisma.lessonReport.findUnique({
      where: { id },
      include: { lesson: true, currentLesson: true },
    })
  },

  async findByCurrentLesson(currentLessonId: string) {
    return prisma.lessonReport.findUnique({
      where: { currentLessonId },
    })
  },

  async findAll(teacherId?: string) {
    return prisma.lessonReport.findMany({
      where: teacherId ? { lesson: { teacherId } } : undefined,
      include: { lesson: true },
      orderBy: { createdAt: "desc" },
    })
  },
}
