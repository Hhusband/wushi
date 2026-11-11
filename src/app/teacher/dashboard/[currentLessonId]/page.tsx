"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSocket } from "@/hooks/useSocket"

interface DashboardData {
  totalGroups: number
  submittedGroups: number
  activeGroups: number
  sessions: {
    id: string
    groupName: string
    status: string
    messageCount: number
    depthScore: number
  }[]
  keywordCloud: { word: string; count: number }[]
  lesson: { subject: string; lessonName: string; coreQuestion: string }
  currentLesson: { grade: string; className: string; status: string; id: string }
}

export default function DashboardPage() {
  const { currentLessonId } = useParams<{ currentLessonId: string }>()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)

  const { joinClassroom, onClassroomUpdate } = useSocket()

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/dashboard/${currentLessonId}`)
      const json = await res.json()
      if (json.currentLesson) setData(json)
    } catch { /* ignore */ }
  }, [currentLessonId])

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 10000)

    // Join socket room for real-time updates
    joinClassroom(currentLessonId as string)
    const unsub = onClassroomUpdate(() => {
      fetchDashboard()
    })

    return () => {
      clearInterval(interval)
      unsub?.()
    }
  }, [fetchDashboard, currentLessonId, joinClassroom, onClassroomUpdate])

  async function handleAgentChat() {
    if (!chatInput.trim()) return
    const input = chatInput
    setChatInput("")
    setChatMessages((prev) => [...prev, { role: "user", content: input }])
    setChatLoading(true)

    try {
      const res = await fetch("/api/teacher/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLessonId,
          message: input,
          history: chatMessages,
        }),
      })
      const json = await res.json()
      setChatMessages((prev) => [...prev, { role: "assistant", content: json.reply }])
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "抱歉，AI助教暂时不可用。" }])
    } finally {
      setChatLoading(false)
    }
  }

  async function handleBriefing() {
    setBriefingLoading(true)
    try {
      const res = await fetch(`/api/teacher/briefing/${currentLessonId}`)
      const json = await res.json()
      setBriefing(json.report)
    } catch {
      setBriefing("简报生成失败，请稍后重试。")
    } finally {
      setBriefingLoading(false)
    }
  }

  async function handleEndClassroom() {
    const token = localStorage.getItem("teacher_token")
    if (!token) return

    await fetch("/api/teacher/classroom/end", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentLessonId }),
    })

    // Fire-and-forget: generate report in background, don't block navigation
    fetch(`/api/reports/generate/${currentLessonId}`, { method: "POST" }).catch(() => {})

    router.push("/teacher/reports")
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-muted-foreground">加载仪表盘...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <Link href="/teacher/lessons" className="text-xl font-bold text-indigo-600">
              吾师
            </Link>
            <span className="ml-3 text-sm text-muted-foreground">
              [{data.lesson.subject}] {data.currentLesson.grade}{data.currentLesson.className} · {data.lesson.lessonName}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDashboard}>
              刷新数据
            </Button>
            <Button variant="outline" size="sm" onClick={handleBriefing} disabled={briefingLoading}>
              {briefingLoading ? "生成中..." : "生成简报"}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleEndClassroom}>
              结束课堂
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-indigo-600">{data.totalGroups}</div>
              <div className="text-sm text-muted-foreground">总小组数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-green-600">{data.submittedGroups}</div>
              <div className="text-sm text-muted-foreground">已提交</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-amber-600">{data.activeGroups}</div>
              <div className="text-sm text-muted-foreground">讨论中</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {data.totalGroups > 0
                  ? Math.round((data.submittedGroups / data.totalGroups) * 100)
                  : 0}%
              </div>
              <div className="text-sm text-muted-foreground">提交率</div>
            </CardContent>
          </Card>
        </div>

        {/* Briefing */}
        {briefing && (
          <Card className="mb-6 border-indigo-200 bg-indigo-50/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base text-indigo-800">课堂简报</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setBriefing(null)}>
                关闭
              </Button>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-sm whitespace-pre-line leading-relaxed">
                {briefing}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Left: session list + keyword cloud */}
          <div className="col-span-2 space-y-6">
            {/* Session list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">小组状态</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          session.status === "submitted"
                            ? "default"
                            : session.status === "active"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {session.status === "submitted"
                          ? "已提交"
                          : session.status === "active"
                            ? "讨论中"
                            : "整理中"}
                      </Badge>
                      <span className="font-medium">{session.groupName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{session.messageCount} 条消息</span>
                      <span>深度: {"★".repeat(Math.min(session.depthScore / 20, 5)) || "☆"}</span>
                    </div>
                  </div>
                ))}
                {data.sessions.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">等待学生加入...</p>
                )}
              </CardContent>
            </Card>

            {/* Keyword cloud */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">关键词云</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.keywordCloud.slice(0, 15).map((kw) => (
                    <span
                      key={kw.word}
                      className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700"
                      style={{
                        fontSize: `${Math.max(0.75, Math.min(1.5, kw.count / 10))}rem`,
                      }}
                    >
                      {kw.word}
                    </span>
                  ))}
                  {data.keywordCloud.length === 0 && (
                    <p className="text-muted-foreground">暂无数据</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: AI Agent Chat */}
          <div className="col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">AI 课堂助手</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 space-y-3 mb-4 max-h-96 overflow-y-auto">
                  {chatMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      问我任何关于课堂的问题：
                      <br />· 哪些小组讨论最深入？
                      <br />· 哪些小组需要帮助？
                      <br />· 学生最大误区是什么？
                      <br />· 帮我设计一个课堂追问
                    </p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-3 text-sm ${
                        msg.role === "user"
                          ? "bg-indigo-50 ml-4"
                          : "bg-zinc-100 mr-4"
                      }`}
                    >
                      <p className="font-medium text-xs text-muted-foreground mb-1">
                        {msg.role === "user" ? "你" : "AI助教"}
                      </p>
                      {msg.content}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="text-sm text-muted-foreground animate-pulse">
                      AI助教思考中...
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAgentChat()}
                    placeholder="输入问题..."
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleAgentChat} disabled={chatLoading}>
                    发送
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
