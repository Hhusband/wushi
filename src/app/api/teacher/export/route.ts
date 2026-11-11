import { NextResponse } from "next/server"
import { verifyToken, extractToken } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function getTeacherId(request: Request) {
  const token = extractToken(request)
  if (!token) throw new Error("未登录")
  const payload = await verifyToken(token)
  if (!payload?.teacherId) throw new Error("未登录")
  return { id: payload.teacherId as string, name: payload.teacherName as string }
}

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n")
}

export async function GET(request: Request) {
  try {
    const teacher = await getTeacherId(request)
    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "json"

    // Fetch all teacher data
    const lessons = await prisma.lesson.findMany({
      where: { teacherId: teacher.id },
      include: {
        currentLessons: {
          include: {
            sessions: {
              include: {
                messages: { orderBy: { createdAt: "asc" } },
                submission: true,
              },
            },
            reports: true,
            submissions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    if (format === "csv") {
      // CSV: submissions-focused flat export
      const headers = [
        "课程名称", "核心问题", "班级", "小组", "课堂时间",
        "主要观点", "依据与证据", "结论", "疑问",
        "学生发言数", "AI回复数", "提交时间",
      ]
      const rows: string[][] = []

      for (const lesson of lessons) {
        for (const cl of lesson.currentLessons) {
          for (const session of cl.sessions) {
            const sub = session.submission
            const studentMsgs = session.messages.filter(m => m.role === "user").length
            const aiMsgs = session.messages.filter(m => m.role === "assistant").length
            const timeRange = cl.endedAt
              ? `${new Date(cl.startedAt).toLocaleString("zh-CN")} - ${new Date(cl.endedAt).toLocaleString("zh-CN")}`
              : new Date(cl.startedAt).toLocaleString("zh-CN")

            rows.push([
              lesson.lessonName,
              lesson.coreQuestion,
              `${lesson.grade}${lesson.className}`,
              session.groupName,
              timeRange,
              sub ? JSON.stringify((sub.mainPoints as any[]).flat().slice(0, 5)) : "",
              sub ? JSON.stringify(sub.evidence) : "",
              sub?.conclusions || "",
              sub?.questions || "",
              String(studentMsgs),
              String(aiMsgs),
              sub?.submittedAt ? new Date(sub.submittedAt).toLocaleString("zh-CN") : "",
            ])
          }
        }
      }

      const csv = "﻿" + toCsv(headers, rows)
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="classroom-export_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    // JSON: full structured export
    const exportData = {
      exportedAt: new Date().toISOString(),
      teacher: { id: teacher.id, name: teacher.name },
      lessons: lessons.map((l) => ({
        id: l.id,
        lessonName: l.lessonName,
        grade: l.grade,
        className: l.className,
        lessonNumber: l.lessonNumber,
        coreQuestion: l.coreQuestion,
        status: l.status,
        createdAt: l.createdAt,
        currentLessons: l.currentLessons.map((cl) => ({
          id: cl.id,
          status: cl.status,
          startedAt: cl.startedAt,
          endedAt: cl.endedAt,
          sessions: cl.sessions.map((s) => ({
            id: s.id,
            groupName: s.groupName,
            groupNumber: s.groupNumber,
            status: s.status,
            messageCount: s.messages.length,
            messages: s.messages.map((m) => ({
              role: m.role,
              authorName: m.authorName,
              content: m.content,
              createdAt: m.createdAt,
            })),
            submission: s.submission
              ? {
                  mainPoints: s.submission.mainPoints,
                  evidence: s.submission.evidence,
                  conclusions: s.submission.conclusions,
                  questions: s.submission.questions,
                  submittedAt: s.submission.submittedAt,
                }
              : null,
          })),
          report: cl.reports[0]
            ? {
                overallSummary: cl.reports[0].overallSummary,
                topGroups: cl.reports[0].topGroups,
                strugglingGroups: cl.reports[0].strugglingGroups,
                commonMisconceptions: cl.reports[0].commonMisconceptions,
                teachingSuggestions: cl.reports[0].teachingSuggestions,
                keywordCloud: cl.reports[0].keywordCloud,
                createdAt: cl.reports[0].createdAt,
              }
            : null,
        })),
      })),
    }

    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="classroom-export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
