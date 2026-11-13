import { NextResponse } from "next/server"
import fs from "fs/promises"
import { prisma } from "@/lib/prisma"
import { resolveStoredPath, verifyMaterialSignature, attachmentHeader, inlineHeader } from "@/lib/uploads"
import { getActiveRound } from "@/lib/rounds"

/**
 * GET /api/materials/[id]/file?k=<签名>
 * 学生无需登录，凭 HMAC 签名访问；仅课堂进行中且已下发的资料可读。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(request.url)
  const signature = url.searchParams.get("k")

  if (!verifyMaterialSignature(id, signature)) {
    return NextResponse.json({ error: "链接无效" }, { status: 403 })
  }

  const material = await prisma.material.findUnique({
    where: { id },
    include: { currentLesson: { include: { lesson: true } } },
  })
  if (!material) return NextResponse.json({ error: "资料不存在" }, { status: 404 })
  if (!material.pushedAt) return NextResponse.json({ error: "资料尚未下发" }, { status: 403 })
  if (material.currentLesson.status !== "active") {
    return NextResponse.json({ error: "课堂已结束" }, { status: 410 })
  }

  // 已结束的轮次资料仍然可看（学生可回看上一轮资料）
  const round = material.roundId
    ? await prisma.discussionRound.findUnique({ where: { id: material.roundId } })
    : null
  const activeRound = await getActiveRound(material.currentLessonId)
  if (round && activeRound && round.seq > activeRound.seq) {
    return NextResponse.json({ error: "资料不可用" }, { status: 403 })
  }

  const absPath = resolveStoredPath(material.currentLessonId, material.storedName)
  if (!absPath) return NextResponse.json({ error: "资料路径异常" }, { status: 500 })

  let stat
  try {
    stat = await fs.stat(absPath)
  } catch {
    return NextResponse.json({ error: "文件已丢失，请联系老师重新上传" }, { status: 404 })
  }

  const total = stat.size
  const range = request.headers.get("range")
  const disposition =
    material.kind === "image" || material.kind === "pdf"
      ? inlineHeader(material.fileName)
      : attachmentHeader(material.fileName)

  const baseHeaders: Record<string, string> = {
    "Content-Type": material.mimeType,
    "Accept-Ranges": "bytes",
    "Content-Disposition": disposition,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  }

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if (!m) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } })
    }
    let start = m[1] ? parseInt(m[1], 10) : 0
    let end = m[2] ? parseInt(m[2], 10) : total - 1
    if (m[1] === "" && m[2]) {
      start = Math.max(total - parseInt(m[2], 10), 0)
      end = total - 1
    }
    if (start > end || start >= total) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } })
    }
    end = Math.min(end, total - 1)
    const buffer = Buffer.alloc(end - start + 1)
    const fh = await fs.open(absPath, "r")
    try {
      await fh.read(buffer, 0, buffer.length, start)
    } finally {
      await fh.close()
    }
    return new NextResponse(new Uint8Array(buffer), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(buffer.length),
      },
    })
  }

  const data = await fs.readFile(absPath)
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(data.length) },
  })
}
