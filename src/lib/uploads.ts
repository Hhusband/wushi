import crypto from "crypto"
import path from "path"
import fs from "fs/promises"

/** 上传文件根目录：本地为 ./uploads，容器内为 /app/uploads（挂载卷） */
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads")

export type MaterialKind = "image" | "pdf" | "docx" | "doc"

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB / 张
export const MAX_DOC_BYTES = 30 * 1024 * 1024 // 30MB / 份
export const MAX_BATCH_BYTES = 50 * 1024 * 1024 // 50MB / 批
export const MAX_IMAGES_PER_BATCH = 10

const EXT_KIND: Record<string, MaterialKind> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".heic": "image",
  ".pdf": "pdf",
  ".docx": "docx",
  ".doc": "doc",
}

const KIND_MIME: Record<MaterialKind, string> = {
  image: "application/octet-stream", // 由扩展名细化，见下面 resolveMime
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
}

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
}

export const SUPPORTED_EXT_HINT = "支持 PDF、Word（.doc/.docx）、图片（jpg/png/webp/gif/heic）"

export function classifyFileName(fileName: string): { kind: MaterialKind; ext: string } | null {
  const ext = path.extname(fileName || "").toLowerCase()
  const kind = EXT_KIND[ext]
  if (!kind) return null
  return { kind, ext }
}

export function resolveMime(ext: string, fallback?: string): string {
  return EXT_MIME[ext] || fallback || "application/octet-stream"
}

export function maxBytesFor(kind: MaterialKind): number {
  return kind === "image" ? MAX_IMAGE_BYTES : MAX_DOC_BYTES
}

/** 去掉扩展名作为默认标题 */
export function defaultTitle(fileName: string): string {
  const base = path.basename(fileName || "")
  const ext = path.extname(base)
  return (ext ? base.slice(0, -ext.length) : base).slice(0, 120) || "资料"
}

/** 保留用户原始文件名用于显示/下载，仅去掉路径分隔符与控制字符 */
export function safeDisplayName(fileName: string): string {
  return (fileName || "file")
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 200)
}

function lessonDir(currentLessonId: string): string {
  return path.join(UPLOAD_ROOT, currentLessonId)
}

/** 保存单个上传文件，返回存储名与真实路径 */
export async function saveUpload(
  currentLessonId: string,
  ext: string,
  data: Buffer
): Promise<{ storedName: string; sizeBytes: number }> {
  const dir = lessonDir(currentLessonId)
  await fs.mkdir(dir, { recursive: true })
  const storedName = `${crypto.randomUUID()}${ext}`
  await fs.writeFile(path.join(dir, storedName), data)
  return { storedName, sizeBytes: data.byteLength }
}

/** 由数据库中的 storedName 解析绝对路径（严格校验，防止路径穿越） */
export function resolveStoredPath(currentLessonId: string, storedName: string): string | null {
  if (!storedName || storedName.includes("/") || storedName.includes("\\") || storedName.includes("..")) {
    return null
  }
  const dir = path.resolve(lessonDir(currentLessonId))
  const abs = path.resolve(dir, storedName)
  if (!abs.startsWith(dir + path.sep)) return null
  return abs
}

/** 课堂结束时清除该课堂的全部资料文件 */
export async function removeLessonUploads(currentLessonId: string): Promise<void> {
  try {
    await fs.rm(lessonDir(currentLessonId), { recursive: true, force: true })
  } catch {
    // 忽略：文件不存在等
  }
}

/** 删除单个资料文件 */
export async function removeStoredFile(currentLessonId: string, storedName: string): Promise<void> {
  const abs = resolveStoredPath(currentLessonId, storedName)
  if (!abs) return
  try {
    await fs.unlink(abs)
  } catch {
    // 忽略
  }
}

// ---- 学生访问资料的签名（防止猜 URL 遍历他人资料）----

function materialSecret(): string {
  return process.env.JWT_SECRET || "classroom-ai-dev-secret"
}

export function signMaterialId(materialId: string): string {
  return crypto
    .createHmac("sha256", materialSecret())
    .update(`material:${materialId}`)
    .digest("hex")
    .slice(0, 32)
}

export function verifyMaterialSignature(materialId: string, signature: string | null): boolean {
  if (!signature) return false
  const expected = Buffer.from(signMaterialId(materialId))
  const given = Buffer.from(signature)
  if (expected.length !== given.length) return false
  return crypto.timingSafeEqual(expected, given)
}

/** RFC 5987 Content-Disposition，兼容中文文件名 */
export function attachmentHeader(fileName: string): string {
  const name = safeDisplayName(fileName)
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  const encoded = encodeURIComponent(name)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

export function inlineHeader(fileName: string): string {
  const name = safeDisplayName(fileName)
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  const encoded = encodeURIComponent(name)
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

// ---- 资料序列化（对前端统一字段）----

export interface MaterialDTO {
  id: string
  currentLessonId: string
  roundId: string | null
  batchId: string | null
  kind: MaterialKind
  title: string
  fileName: string
  mimeType: string
  sizeBytes: number
  sortOrder: number
  pushedAt: string | null
  createdAt: string
  url: string
}

export function toMaterialDTO(
  m: {
    id: string
    currentLessonId: string
    roundId: string | null
    batchId: string | null
    kind: string
    title: string
    fileName: string
    mimeType: string
    sizeBytes: number
    sortOrder: number
    pushedAt: Date | null
    createdAt: Date
  }
): MaterialDTO {
  const sig = signMaterialId(m.id)
  return {
    id: m.id,
    currentLessonId: m.currentLessonId,
    roundId: m.roundId,
    batchId: m.batchId,
    kind: m.kind as MaterialKind,
    title: m.title,
    fileName: m.fileName,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    sortOrder: m.sortOrder,
    pushedAt: m.pushedAt ? m.pushedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    url: `/api/materials/${m.id}/file?k=${sig}`,
  }
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
