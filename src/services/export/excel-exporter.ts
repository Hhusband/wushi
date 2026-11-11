import path from "path"
import fs from "fs"
import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 200)
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

function getExportRoot(): string {
  // /app/exports in Docker (mounted volume), ./exports locally
  return path.join(process.cwd(), "exports")
}

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } },
  alignment: { horizontal: "center", vertical: "middle" },
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchSessionData(sessionId: string) {
  return prisma.studentSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      submission: true,
      currentLesson: {
        include: {
          lesson: { select: { teacherId: true, lessonName: true } },
          reports: { take: 1, orderBy: { createdAt: "desc" } },
        },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------

function buildMessagesSheet(ws: ExcelJS.Worksheet, messages: Array<{
  createdAt: Date; role: string; authorName: string | null; content: string
}>) {
  ws.columns = [
    { header: "序号", key: "index", width: 6 },
    { header: "时间", key: "time", width: 22 },
    { header: "角色", key: "role", width: 10 },
    { header: "发言人", key: "author", width: 16 },
    { header: "内容", key: "content", width: 80 },
  ]
  ws.getRow(1).eachCell((c) => { c.style = { ...HEADER_STYLE } as ExcelJS.Style })

  const roleLabel: Record<string, string> = { user: "学生", assistant: "AI", system: "系统" }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    ws.addRow({
      index: i + 1,
      time: m.createdAt.toLocaleString("zh-CN"),
      role: roleLabel[m.role] || m.role,
      author: m.authorName || "",
      content: m.content,
    })
  }

  ws.getColumn(5).eachCell((c, rowNum) => {
    if (rowNum > 1) c.alignment = { wrapText: true, vertical: "top" }
  })
}

function buildSubmissionSheet(ws: ExcelJS.Worksheet, submission: {
  groupName: string; mainPoints: unknown; evidence: unknown; conclusions: string
  questions: string; submittedAt: Date
} | null) {
  ws.columns = [
    { header: "项目", key: "label", width: 16 },
    { header: "内容", key: "value", width: 90 },
  ]
  ws.getRow(1).eachCell((c) => { c.style = { ...HEADER_STYLE } as ExcelJS.Style })

  if (!submission) {
    ws.addRow({ label: "状态", value: "暂无提交" })
    return
  }

  const mp = Array.isArray(submission.mainPoints)
    ? (submission.mainPoints as any[]).flat().join("\n")
    : ""
  const ev = Array.isArray(submission.evidence)
    ? JSON.stringify(submission.evidence, null, 2)
    : ""

  const rows = [
    { label: "小组名称", value: submission.groupName },
    { label: "主要观点", value: mp },
    { label: "依据与证据", value: ev },
    { label: "结论", value: submission.conclusions },
    { label: "疑问", value: submission.questions },
    { label: "提交时间", value: submission.submittedAt.toLocaleString("zh-CN") },
  ]
  for (const r of rows) {
    const row = ws.addRow(r)
    row.getCell(2).alignment = { wrapText: true, vertical: "top" }
    row.height = 20
  }
}

function buildReportSheet(ws: ExcelJS.Worksheet, report: Record<string, unknown> | null) {
  ws.columns = [
    { header: "项目", key: "label", width: 18 },
    { header: "内容", key: "value", width: 90 },
  ]
  ws.getRow(1).eachCell((c) => { c.style = { ...HEADER_STYLE } as ExcelJS.Style })

  if (!report) {
    ws.addRow({ label: "状态", value: "暂无报告" })
    return
  }

  const fields: [string, string][] = [
    ["总体总结", "overallSummary"],
    ["优秀小组", "topGroups"],
    ["需关注小组", "strugglingGroups"],
    ["常见误解", "commonMisconceptions"],
    ["教学建议", "teachingSuggestions"],
    ["后续问题", "followUpQuestions"],
    ["板书建议", "boardSuggestions"],
    ["作业建议", "homeworkSuggestions"],
  ]

  for (const [label, key] of fields) {
    const raw = report[key]
    const value = Array.isArray(raw) ? JSON.stringify(raw, null, 2) : String(raw ?? "")
    const row = ws.addRow({ label, value: value || "—" })
    row.getCell(2).alignment = { wrapText: true, vertical: "top" }
    row.height = 20
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export a single session to an .xlsx file.
 * Returns the absolute file path.
 */
export async function exportSessionToExcel(sessionId: string): Promise<string | null> {
  const data = await fetchSessionData(sessionId)
  if (!data) return null

  const teacherId = data.currentLesson.lesson.teacherId

  const teacher = await prisma.teacherAccess.findUnique({
    where: { id: teacherId },
    select: { teacherName: true },
  })
  const teacherName = teacher?.teacherName || teacherId

  const lessonName = sanitize(data.currentLesson.lesson.lessonName || "未命名课程")
  const groupName = sanitize(data.groupName || `第${data.groupNumber}组`)

  const dir = path.join(getExportRoot(), teacherId, lessonName)
  ensureDir(dir)

  const filePath = path.join(dir, `${groupName}.xlsx`)

  const wb = new ExcelJS.Workbook()
  wb.creator = teacherName

  buildMessagesSheet(wb.addWorksheet("讨论记录"), data.messages)
  buildSubmissionSheet(wb.addWorksheet("小组提交"), data.submission as any)
  buildReportSheet(wb.addWorksheet("课堂报告"), data.currentLesson.reports[0] as any)

  await wb.xlsx.writeFile(filePath)
  return filePath
}

/**
 * Export all sessions in a CurrentLesson (batch, for classroom end).
 */
export async function exportClassroomToExcel(currentLessonId: string): Promise<string[]> {
  const sessions = await prisma.studentSession.findMany({
    where: { currentLessonId },
    select: { id: true },
  })

  const results: string[] = []
  for (const s of sessions) {
    const filePath = await exportSessionToExcel(s.id)
    if (filePath) results.push(filePath)
  }
  return results
}
