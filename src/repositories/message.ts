import { prisma } from "@/lib/prisma"

export const messageRepo = {
  async findBySessionId(sessionId: string, limit = 100) {
    return prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: limit,
    })
  },

  async create(data: {
    sessionId: string
    role: string
    authorName?: string
    content: string
    metadata?: Record<string, unknown>
  }) {
    return prisma.message.create({
      data: {
        sessionId: data.sessionId,
        role: data.role,
        authorName: data.authorName || null,
        content: data.content,
        metadata: (data.metadata || {}) as any,
      },
    })
  },

  async countBySession(sessionId: string) {
    return prisma.message.count({ where: { sessionId } })
  },
}
