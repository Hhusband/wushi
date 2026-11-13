import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken, extractToken } from "@/lib/auth"
import { generateRoundSummary } from "@/lib/rounds"

async function requireTeacher(request: Request, roundId: string) {
  const token = extractToken(request)
  if (!token) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }
  const payload = await verifyToken(token)
  if (!payload?.teacherId) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }

  const round = await prisma.discussionRound.findUnique({
    where: { id: roundId },
    include: { currentLesson: true },
  })
  if (!round) return { error: NextResponse.json({ error: "轮次不存在" }, { status: 404 }) }
  if (round.currentLesson.teacherId !== (payload.teacherId as string)) {
    return { error: NextResponse.json({ error: "无权操作该轮次" }, { status: 403 }) }
  }
  return { round }
}

/** POST /api/teacher/rounds/[id]/summary —— 生成本轮 AI 小结 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireTeacher(request, id)
  if ("error" in auth) return auth.error

  try {
    const result = await generateRoundSummary(id)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "生成失败" }, { status: 500 })
  }
}
