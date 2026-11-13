import { prisma } from "@/lib/prisma"
import { normalizeClassName, normalizeGrade } from "@/lib/utils"

export const currentLessonRepo = {
  async findActive(grade: string, className: string) {
    // 班级/年级名称可能有「一班 / 1班」两种历史写法：按规范化后的名称匹配
    const wantGrade = normalizeGrade(grade)
    const wantClass = normalizeClassName(className)
    const candidates = await prisma.currentLesson.findMany({
      where: { grade: wantGrade, status: "active" },
      include: { lesson: true },
      orderBy: { startedAt: "desc" },
    })
    return candidates.find((c) => normalizeClassName(c.className) === wantClass) || null
  },

  async findById(id: string) {
    return prisma.currentLesson.findUnique({
      where: { id },
      include: { lesson: true },
    })
  },

  async start(data: { lessonId: string; teacherId: string; grade: string; className: string }) {
    const grade = normalizeGrade(data.grade)
    const className = normalizeClassName(data.className)

    // End any existing active classroom for this grade/class（按规范化名称比较）
    const sameClassActives = await prisma.currentLesson.findMany({
      where: { grade, status: "active" },
      select: { id: true, className: true },
    })
    const idsToEnd = sameClassActives
      .filter((c) => normalizeClassName(c.className) === className)
      .map((c) => c.id)
    if (idsToEnd.length > 0) {
      await prisma.currentLesson.updateMany({
        where: { id: { in: idsToEnd } },
        data: { status: "ended", endedAt: new Date() },
      })
    }

    return prisma.currentLesson.create({
      data: {
        lessonId: data.lessonId,
        teacherId: data.teacherId,
        grade,
        className,
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
