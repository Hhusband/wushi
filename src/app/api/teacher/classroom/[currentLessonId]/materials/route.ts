import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken, extractToken } from "@/lib/auth"
import {
  classifyFileName,
  resolveMime,
  maxBytesFor,
  defaultTitle,
  saveUpload,
  toMaterialDTO,
  MAX_BATCH_BYTES,
  MAX_IMAGES_PER_BATCH,
  SUPPORTED_EXT_HINT,
} from "@/lib/uploads"
import { emitClassroomUpdate } from "@/lib/socket-server"
import { getActiveRound } from "@/lib/rounds"

async function requireTeacher(request: Request, currentLessonId: string) {
  const token = extractToken(request)
  if (!token) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }
  const payload = await verifyToken(token)
  if (!payload?.teacherId) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) }
  const cl = await prisma.currentLesson.findUnique({ where: { id: currentLessonId } })
  if (!cl) return { error: NextResponse.json({ error: "课堂不存在" }, { status: 404 }) }
  if (cl.teacherId !== (payload.teacherId as string)) {
    return { error: NextResponse.json({ error: "无权操作该课堂" }, { status: 403 }) }
  }
  return { cl, teacherId: payload.teacherId as string }
}

/** GET /api/teacher/classroom/[currentLessonId]/materials —— 本节课堂资料列表 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ currentLessonId: string }> }
) {
  const { currentLessonId } = await params
  const auth = await requireTeacher(request, currentLessonId)
  if ("error" in auth) return auth.error

  const materials = await prisma.material.findMany({
    where: { currentLessonId },
    orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }],
  })

  const rounds = await prisma.discussionRound.findMany({
    where: { currentLessonId },
    orderBy: { seq: "asc" },
    select: { id: true, seq: true, title: true, status: true },
  })

  return NextResponse.json({ materials: materials.map(toMaterialDTO), rounds })
}

/** POST /api/teacher/classroom/[currentLessonId]/materials —— multipart 上传（图片可一次多张） */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ currentLessonId: string }> }
) {
  const { currentLessonId } = await params
  const auth = await requireTeacher(request, currentLessonId)
  if ("error" in auth) return auth.error
  const cl = auth.cl

  if (cl.status !== "active") {
    return NextResponse.json({ error: "课堂已结束，无法上传资料" }, { status: 400 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "上传数据格式错误" }, { status: 400 })
  }

  const files = form.getAll("files").filter((v): v is File => v instanceof File && v.size > 0)
  if (files.length === 0) return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 })

  const rawTitle = String(form.get("title") || "").trim().slice(0, 200)
  const rawRoundId = String(form.get("roundId") || "").trim()
  const pushNow = String(form.get("push") || "") === "1"

  // 轮次校验（只能挂到本节课堂的轮次）
  let roundId: string | null = null
  if (rawRoundId) {
    const round = await prisma.discussionRound.findFirst({
      where: { id: rawRoundId, currentLessonId },
      select: { id: true },
    })
    if (!round) return NextResponse.json({ error: "轮次不存在" }, { status: 400 })
    roundId = round.id
  }

  // 「上传后立即下发」但未指定轮次时，自动挂到当前进行中的轮次，
  // 保证学生端按轮次分组时能看到该资料、教师端轮次时间线的资料数也对得上。
  if (pushNow && !roundId) {
    const activeRound = await getActiveRound(currentLessonId)
    roundId = activeRound?.id ?? null
  }

  const classified = files.map((f) => ({ file: f, info: classifyFileName(f.name) }))
  const bad = classified.find((c) => !c.info)
  if (bad) {
    return NextResponse.json(
      { error: `不支持的文件类型：${bad.file.name}。${SUPPORTED_EXT_HINT}` },
      { status: 400 }
    )
  }

  const imageCount = classified.filter((c) => c.info!.kind === "image").length
  if (imageCount > 0 && imageCount !== files.length) {
    return NextResponse.json({ error: "图片与文档请分开上传" }, { status: 400 })
  }
  if (imageCount > MAX_IMAGES_PER_BATCH) {
    return NextResponse.json({ error: `一次最多上传 ${MAX_IMAGES_PER_BATCH} 张图片` }, { status: 400 })
  }
  if (imageCount === 0 && files.length > 1) {
    return NextResponse.json({ error: "文档每次只能上传一份" }, { status: 400 })
  }

  let totalBytes = 0
  for (const c of classified) {
    const kind = c.info!.kind
    if (c.file.size > maxBytesFor(kind)) {
      return NextResponse.json(
        {
          error: `「${c.file.name}」超过大小上限（${kind === "image" ? "单张 10MB" : "单个 30MB"}）`,
        },
        { status: 400 }
      )
    }
    totalBytes += c.file.size
  }
  if (totalBytes > MAX_BATCH_BYTES) {
    return NextResponse.json({ error: "单次上传总大小不能超过 50MB" }, { status: 400 })
  }

  const batchId = imageCount > 1 ? crypto.randomUUID() : null
  const now = new Date()
  const created: Awaited<ReturnType<typeof prisma.material.create>>[] = []

  for (let i = 0; i < classified.length; i++) {
    const { file, info } = classified[i]
    const ext = info!.ext
    const buffer = Buffer.from(await file.arrayBuffer())
    const { storedName, sizeBytes } = await saveUpload(currentLessonId, ext, buffer)
    const title = imageCount > 1 ? rawTitle || defaultTitle(files[0].name) : rawTitle || defaultTitle(file.name)

    const row = await prisma.material.create({
      data: {
        currentLessonId,
        roundId,
        batchId,
        kind: info!.kind,
        title,
        fileName: file.name.slice(0, 200),
        storedName,
        mimeType: resolveMime(ext, file.type),
        sizeBytes,
        sortOrder: i,
        pushedAt: pushNow ? now : null,
      },
    })
    created.push(row)
  }

  emitClassroomUpdate(currentLessonId, { type: "materials_changed" })

  return NextResponse.json({ materials: created.map(toMaterialDTO) })
}
