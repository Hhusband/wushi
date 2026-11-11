import { prisma } from "@/lib/prisma"

export const currentLessonRepo = {
  async findActive(grade: string, className: string) {
    return prisma.currentLesson.findFirst({
      where: { grade, className, status: "active" },
      include: { lesson: true },
      orderBy: { startedAt: "desc" },
    })
  },

  async findById(id: string) {
    return prisma.currentLesson.findUnique({
      where: { id },
      include: { lesson: true },
    })
  },

  async start(data: { lessonId: string; teacherId: string; grade: string; className: string }) {
    // End any existing active classroom for this grade/class
    await prisma.currentLesson.updateMany({
      where: { grade: data.grade, className: data.className, status: "active" },
      data: { status: "ended", endedAt: new Date() },
    })

    return prisma.currentLesson.create({
      data: {
        lessonId: data.lessonId,
        teacherId: data.teacherId,
        grade: data.grade,
        className: data.className,
        status: "active",
      },
      include: { lesson: true },
    })
  },

  async end(id: string) {
    return prisma.currentLesson.update({
      where: { id },
      data: { status: "ended", endedAt: new Date() },
    })
  },

  async getTeacherActive(teacherId: string) {
    return prisma.currentLesson.findFirst({
      where: { teacherId, status: "active" },
      include: { lesson: true },
      orderBy: { startedAt: "desc" },
    })
  },
}
