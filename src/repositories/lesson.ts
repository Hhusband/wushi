import { prisma } from "@/lib/prisma"
import type { CreateLessonInput } from "@/types"
import { normalizeClassName, normalizeGrade } from "@/lib/utils"

export const lessonRepo = {
  async findAll(teacherId: string) {
    return prisma.lesson.findMany({
      where: { teacherId },
      orderBy: { updatedAt: "desc" },
    })
  },

  async findById(id: string) {
    return prisma.lesson.findUnique({ where: { id } })
  },

  async create(teacherId: string, input: CreateLessonInput) {
    return prisma.lesson.create({
      data: {
        teacherId,
        subject: input.subject || "语文",
        grade: normalizeGrade(input.grade),
        className: normalizeClassName(input.className),
        lessonNumber: input.lessonNumber,
        lessonName: input.lessonName,
        coreQuestion: input.coreQuestion,
        followUpQuestions: input.followUpQuestions || [],
        discussionRequirements: input.discussionRequirements || "",
        status: "draft",
      },
    })
  },

  async update(id: string, input: Partial<CreateLessonInput>) {
    return prisma.lesson.update({
      where: { id },
      data: {
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.grade !== undefined && { grade: normalizeGrade(input.grade) }),
        ...(input.className !== undefined && { className: normalizeClassName(input.className) }),
        ...(input.lessonNumber !== undefined && { lessonNumber: input.lessonNumber }),
        ...(input.lessonName !== undefined && { lessonName: input.lessonName }),
        ...(input.coreQuestion !== undefined && { coreQuestion: input.coreQuestion }),
        ...(input.followUpQuestions !== undefined && { followUpQuestions: input.followUpQuestions }),
        ...(input.discussionRequirements !== undefined && { discussionRequirements: input.discussionRequirements }),
      },
    })
  },

  async publish(id: string) {
    return prisma.lesson.update({
      where: { id },
      data: { status: "published" },
    })
  },

  async delete(id: string) {
    return prisma.lesson.delete({ where: { id } })
  },

  async findActiveLesson(grade: string, className: string) {
    const wantGrade = normalizeGrade(grade)
    const wantClass = normalizeClassName(className)
    const candidates = await prisma.currentLesson.findMany({
      where: { grade: wantGrade, status: "active" },
      include: { lesson: true },
      orderBy: { startedAt: "desc" },
    })
    return candidates.find((c) => normalizeClassName(c.className) === wantClass) || null
  },
}
