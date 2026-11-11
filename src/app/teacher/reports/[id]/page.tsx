"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ReportData {
  id: string
  overallSummary: string
  topGroups: { groupName: string; reason: string; excerpt: string }[]
  strugglingGroups: { groupName: string; issue: string; suggestion: string }[]
  commonMisconceptions: { misconception: string; example: string; correction: string }[]
  teachingSuggestions: string
  followUpQuestions: { question: string; purpose: string }[]
  boardSuggestions: string
  homeworkSuggestions: string
  keywordCloud: { word: string; count: number }[]
  discussionDepthScores: { groupName: string; score: number; comment: string }[]
  createdAt: string
  lesson: { lessonName: string; grade: string; className: string; coreQuestion: string }
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.report) setReport(data.report)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-muted-foreground">加载报告...</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-muted-foreground">报告不存在</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
          <Link href="/teacher/reports" className="text-sm text-muted-foreground hover:text-foreground">
            ← 返回报告列表
          </Link>
          <span className="ml-4 font-medium">
            {report.lesson.grade}{report.lesson.className} · {report.lesson.lessonName}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="groups">小组分析</TabsTrigger>
            <TabsTrigger value="teaching">教学建议</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>课堂总体情况</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{report.overallSummary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>关键词云</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {report.keywordCloud?.map((kw) => (
                    <span
                      key={kw.word}
                      className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700"
                      style={{ fontSize: `${Math.max(0.75, Math.min(1.5, kw.count / 10))}rem` }}
                    >
                      {kw.word}({kw.count})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>优秀小组</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {report.topGroups?.map((g, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>{["🥇", "🥈", "🥉"][i] || "⭐"}</Badge>
                      <span className="font-medium">{g.groupName}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{g.reason}</p>
                    {g.excerpt && (
                      <p className="mt-2 text-sm bg-zinc-50 rounded p-2 italic">"{g.excerpt}"</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>需要关注的小组</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {report.strugglingGroups?.map((g, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">⚠️</Badge>
                      <span className="font-medium">{g.groupName}</span>
                    </div>
                    <p className="text-sm">问题: {g.issue}</p>
                    <p className="text-sm text-muted-foreground mt-1">建议: {g.suggestion}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>讨论深度评分</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {report.discussionDepthScores?.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="font-medium">{s.groupName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{s.comment}</span>
                      <span className="text-amber-500">
                        {"★".repeat(s.score)}{"☆".repeat(5 - s.score)}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teaching" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>常见误区</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {report.commonMisconceptions?.map((m, i) => (
                  <div key={i} className="rounded-lg border border-red-100 p-4">
                    <p className="font-medium text-red-700">误区: {m.misconception}</p>
                    <p className="text-sm mt-1">例子: {m.example}</p>
                    <p className="text-sm text-green-700 mt-1">修正: {m.correction}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>教学建议</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{report.teachingSuggestions}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>课堂追问</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {report.followUpQuestions?.map((q, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <p className="font-medium">{i + 1}. {q.question}</p>
                    <p className="text-sm text-muted-foreground mt-1">目的: {q.purpose}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>板书建议</CardTitle></CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans">{report.boardSuggestions}</pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>作业建议</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{report.homeworkSuggestions}</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
