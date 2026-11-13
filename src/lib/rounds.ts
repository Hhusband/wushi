import { prisma } from "@/lib/prisma"
import { chatSimple } from "@/services/llm/client"
import { removeLessonUploads } from "@/lib/uploads"

export interface RoundDTO {
  id: string
  currentLessonId: string
  seq: number
  title: string
  question: string
  requirements: string
  status: string
  allowSubmit: boolean
  summary: string
  startedAt: string | null
  endedAt: string | null
  createdAt: string
}

type RoundRow = {
  id: string
  currentLessonId: string
  seq: number
  title: string
  question: string
  requirements: string
  status: string
  allowSubmit: boolean
  summary: string
  startedAt: Date | null
  endedAt: Date | null
  createdAt: Date
}

export function toRoundDTO(r: RoundRow): RoundDTO {
  return {
    id: r.id,
    currentLessonId: r.currentLessonId,
    seq: r.seq,
    title: r.title,
    question: r.question,
    requirements: r.requirements,
    status: r.status,
    allowSubmit: r.allowSubmit,
    summary: r.summary,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    endedAt: r.endedAt ? r.endedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }
}

/** 当前进行中的轮次（理论上每节课最多一个） */
export async function getActiveRound(currentLessonId: string): Promise<RoundRow | null> {
  return prisma.discussionRound.findFirst({
    where: { currentLessonId, status: "active" },
    orderBy: { seq: "desc" },
  })
}

/** 启动课堂时创建第 1 轮讨论（幂等） */
export async function ensureFirstRound(currentLessonId: string): Promise<RoundRow> {
  const existing = await prisma.discussionRound.findFirst({
    where: { currentLessonId, seq: 1 },
  })
  if (existing) return existing

  const cl = await prisma.currentLesson.findUnique({
    where: { id: currentLessonId },
    include: { lesson: true },
  })
  if (!cl) throw new Error("课堂不存在")

  return prisma.discussionRound.create({
    data: {
      currentLessonId,
      seq: 1,
      title: "第一轮讨论",
      question: cl.lesson.coreQuestion,
      requirements: cl.lesson.discussionRequirements || "",
      status: "active",
      allowSubmit: true,
      startedAt: new Date(),
    },
  })
}

export function formatRoundStartMessage(seq: number, question: string, requirements: string): string {
  const lines = [`【第${seq}轮讨论开始】`, question]
  if (requirements && requirements.trim()) lines.push(`讨论要求：${requirements.trim()}`)
  const hasMaterials = "（本轮如有资料，可在讨论页右侧的「资料」中查看）"
  lines.push(`请围绕新的问题继续讨论。${hasMaterials}`)
  return lines.join("\n")
}

export interface PublishRoundInput {
  currentLessonId: string
  question: string
  title?: string
  requirements?: string
  materialIds?: string[]
  allowSubmit?: boolean
}

/**
 * 发布下一轮讨论：结束当前轮 → 新建轮次 → 本轮资料挂到新轮并立即下发 →
 * 各小组插入系统消息 → 重新激活（此前已提交的）小组。
 */
export async function publishRound(input: PublishRoundInput) {
  const { currentLessonId } = input
  const question = (input.question || "").trim()
  if (!question) throw new Error("讨论问题不能为空")

  const cl = await prisma.currentLesson.findUnique({ where: { id: currentLessonId } })
  if (!cl) throw new Error("课堂不存在")
  if (cl.status !== "active") throw new Error("课堂已结束，无法发布新一轮")

  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    // 结束当前所有进行中的轮次
    await tx.discussionRound.updateMany({
      where: { currentLessonId, status: "active" },
      data: { status: "ended", endedAt: now },
    })

    const last = await tx.discussionRound.findFirst({
      where: { currentLessonId },
      orderBy: { seq: "desc" },
    })
    const seq = (last?.seq ?? 0) + 1

    const round = await tx.discussionRound.create({
      data: {
        currentLessonId,
        seq,
        title: (input.title || "").trim() || `第${seq}轮讨论`,
        question,
        requirements: (input.requirements || "").trim(),
        status: "active",
        allowSubmit: input.allowSubmit ?? true,
        startedAt: now,
      },
    })

    // 本轮资料：挂到新轮并立即下发
    const ids = (input.materialIds || []).filter(Boolean)
    if (ids.length > 0) {
      await tx.material.updateMany({
        where: { id: { in: ids }, currentLessonId },
        data: { roundId: round.id, pushedAt: now },
      })
    }

    const sessions = await tx.studentSession.findMany({
      where: { currentLessonId },
      select: { id: true, status: true },
    })

    if (sessions.length > 0) {
      const content = formatRoundStartMessage(seq, question, round.requirements)
      await tx.message.createMany({
        data: sessions.map((s) => ({
          sessionId: s.id,
          roundId: round.id,
          role: "system",
          content,
          metadata: { type: "round_start", roundId: round.id, seq },
        })),
      })
      // 之前已提交/总结中的小组重新回到讨论状态，保证能参与新一轮
      await tx.studentSession.updateMany({
        where: { currentLessonId, status: { in: ["summarizing", "submitted"] } },
        data: { status: "active" },
      })
    }

    return { round, sessionCount: sessions.length }
  })

  return result
}

/** 手动结束某一轮（通常由发布下一轮自动完成） */
export async function endRound(roundId: string) {
  return prisma.discussionRound.update({
    where: { id: roundId },
    data: { status: "ended", endedAt: new Date() },
  })
}

export async function updateRound(
  roundId: string,
  data: { title?: string; question?: string; requirements?: string; allowSubmit?: boolean }
) {
  const patch: Record<string, unknown> = {}
  if (data.title !== undefined) patch.title = data.title.trim().slice(0, 200)
  if (data.question !== undefined) patch.question = data.question.trim()
  if (data.requirements !== undefined) patch.requirements = data.requirements.trim()
  if (data.allowSubmit !== undefined) patch.allowSubmit = data.allowSubmit
  return prisma.discussionRound.update({ where: { id: roundId }, data: patch })
}

export async function getRoundWithLesson(roundId: string) {
  return prisma.discussionRound.findUnique({
    where: { id: roundId },
    include: { currentLesson: { include: { lesson: true } } },
  })
}

const ROUND_SUMMARY_PROMPT = `你是一位资深教研员，负责为 {{subject}} 课堂第 {{seq}} 轮小组讨论生成「本轮小结」。
本轮讨论问题：{{question}}
{{requirementsLine}}

请根据下面各组在本轮的发言，用中文输出，分四段（每段 1-3 句，总字数不超过 400 字）：
【本轮概况】参与小组数、讨论活跃度、整体印象
【各组观点】按小组简述主要观点与依据（可合并相近的小组）
【共性问题】本轮暴露的理解偏差、证据不足或需要澄清的概念
【教学建议】教师下一步可以追问什么、需要补充哪类资料或讲解哪一点

要求：具体、克制，只基于学生发言，不要编造。`

export interface RoundSummaryResult {
  summary: string
  roundId: string
  sessionCount: number
  messageCount: number
}

/** 生成某一轮的 AI 小结（复用简报的 chatSimple 范式） */
export async function generateRoundSummary(roundId: string): Promise<RoundSummaryResult> {
  const round = await prisma.discussionRound.findUnique({
    where: { id: roundId },
    include: { currentLesson: { include: { lesson: true } } },
  })
  if (!round) throw new Error("轮次不存在")

  const sessions = await prisma.studentSession.findMany({
    where: { currentLessonId: round.currentLessonId },
    orderBy: { groupNumber: "asc" },
  })

  const messages = await prisma.message.findMany({
    where: { roundId, sessionId: { in: sessions.map((s) => s.id) } },
    orderBy: { createdAt: "asc" },
    select: { sessionId: true, role: true, authorName: true, content: true },
  })

  const bySession = new Map<string, { role: string; authorName: string | null; content: string }[]>()
  for (const m of messages) {
    const list = bySession.get(m.sessionId) || []
    list.push({ role: m.role, authorName: m.authorName, content: m.content })
    bySession.set(m.sessionId, list)
  }

  const lines: string[] = []
  lines.push(`课堂：${round.currentLesson.grade}${round.currentLesson.className} ${round.currentLesson.lesson.lessonName}`)
  lines.push(`本轮问题：${round.question}`)
  if (round.requirements) lines.push(`讨论要求：${round.requirements}`)
  lines.push("")

  const activeGroupCount = sessions.filter((s) =>
    (bySession.get(s.id) || []).some((m) => m.role === "student")
  ).length
  lines.push(
    `本轮共 ${sessions.length} 个小组，其中 ${activeGroupCount} 个小组有学生发言。请严格按实际小组数统计，不要编造小组。`
  )
  lines.push("")

  let emptyGroups = 0
  for (const s of sessions) {
    const list = bySession.get(s.id) || []
    const studentMsgs = list.filter((m) => m.role === "student")
    if (studentMsgs.length === 0) {
      emptyGroups += 1
      continue
    }
    lines.push(`【${s.groupName}】（${studentMsgs.length} 条学生发言）`)
    const kept = list.slice(-30)
    for (const m of kept) {
      if (m.role === "system") continue
      const who = m.role === "student" ? m.authorName || "学生" : "AI助手"
      lines.push(`${who}：${m.content.replace(/\s+/g, " ").slice(0, 200)}`)
    }
    lines.push("")
  }

  if (emptyGroups > 0) lines.push(`另有 ${emptyGroups} 个小组本轮暂无发言。`)

  const teacherRole = round.currentLesson.lesson.teacherId ? "任课教师" : "教师"
  const systemPrompt = ROUND_SUMMARY_PROMPT.replace("{{subject}}", round.currentLesson.lesson.subject)
    .replace("{{seq}}", String(round.seq))
    .replace("{{question}}", round.question)
    .replace("{{requirementsLine}}", round.requirements ? `本轮讨论要求：${round.requirements}` : "本轮无额外讨论要求。")
    .replace("{{teacherRole}}", teacherRole)

  const summary = await chatSimple(systemPrompt, lines.join("\n"), {
    temperature: 0.5,
    maxTokens: 900,
  })

  await prisma.discussionRound.update({
    where: { id: roundId },
    data: { summary },
  })

  return {
    summary,
    roundId,
    sessionCount: sessions.length,
    messageCount: messages.length,
  }
}

/** 课堂结束时清除本次上传的全部资料（记录 + 文件） */
export async function cleanupLessonMaterials(currentLessonId: string): Promise<number> {
  const count = await prisma.material.count({ where: { currentLessonId } })
  await prisma.material.deleteMany({ where: { currentLessonId } })
  await removeLessonUploads(currentLessonId)
  return count
}
