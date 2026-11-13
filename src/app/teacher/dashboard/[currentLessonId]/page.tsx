"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useSocket } from "@/hooks/useSocket"
import { PublishRoundDialog } from "@/components/teacher/publish-round-dialog"
import { MaterialManager } from "@/components/teacher/material-manager"
import { GroupConversationModal } from "@/components/teacher/group-conversation-modal"
import type { DashboardData, MaterialData, RoundData } from "@/types"

const btnStyle = { WebkitAppearance: "button" as const, cursor: "pointer", touchAction: "manipulation" as const }

const FILTER_ALL = "all"

export default function DashboardPage() {
  const { currentLessonId } = useParams<{ currentLessonId: string }>()
  const router = useRouter()

  const [data, setData] = useState<DashboardData | null>(null)
  const [tab, setTab] = useState<"board" | "materials">("board")
  const [roundFilter, setRoundFilter] = useState<string>(FILTER_ALL)
  const [showPublish, setShowPublish] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryByRound, setSummaryByRound] = useState<Record<string, string>>({})
  const [groupModal, setGroupModal] = useState<{ id: string; name: string } | null>(null)

  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)

  const { joinClassroom, onClassroomUpdate } = useSocket()

  const rounds: RoundData[] = useMemo(() => data?.rounds || [], [data])
  const materials: MaterialData[] = useMemo(() => data?.materials || [], [data])
  const activeRound = useMemo(() => rounds.find((r) => r.status === "active") || null, [rounds])
  const filteredRound = useMemo(
    () => (roundFilter === FILTER_ALL ? null : rounds.find((r) => r.id === data?.filterRoundId) || null),
    [roundFilter, rounds, data]
  )
  const shownRound = useMemo(
    () => filteredRound || activeRound,
    [filteredRound, activeRound]
  )

  const summaryTarget = useMemo(() => {
    if (roundFilter !== FILTER_ALL) return filteredRound
    return activeRound
  }, [roundFilter, filteredRound, activeRound])
  const isActive = data?.currentLesson?.status === "active"

  const fetchDashboard = useCallback(async () => {
    try {
      const query = roundFilter === FILTER_ALL ? "" : `?roundId=${encodeURIComponent(roundFilter)}`
      const res = await fetch(`/api/teacher/dashboard/${currentLessonId}${query}`, { cache: "no-store" })
      const json = await res.json()
      if (json.currentLesson) setData(json)
    } catch {
      /* ignore */
    }
  }, [currentLessonId, roundFilter])

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 10000)
    joinClassroom(currentLessonId as string)
    const unsub = onClassroomUpdate(() => fetchDashboard())
    return () => {
      clearInterval(interval)
      unsub?.()
    }
  }, [fetchDashboard, currentLessonId, joinClassroom, onClassroomUpdate])

  function tokenHeader(json = true): HeadersInit {
    const token = localStorage.getItem("teacher_token")
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (json) headers["Content-Type"] = "application/json"
    return headers
  }

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
        body: JSON.stringify({ currentLessonId, message: input, history: chatMessages }),
      })
      const json = await res.json()
      setChatMessages((prev) => [...prev, { role: "assistant", content: json.reply }])
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "抱歉，AI助教暂时不可用。" }])
    } finally {
      setChatLoading(false)
    }
  }

  async function handleRoundSummary() {
    if (!summaryTarget) return
    setSummaryLoading(true)
    try {
      const res = await fetch(`/api/teacher/rounds/${summaryTarget.id}/summary`, {
        method: "POST",
        headers: tokenHeader(false),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "生成失败")
      setSummaryByRound((prev) => ({ ...prev, [summaryTarget.id]: json.summary }))
      fetchDashboard()
    } catch (e: any) {
      window.alert(e.message || "生成失败")
    } finally {
      setSummaryLoading(false)
    }
  }

  async function handleEndRound() {
    if (!activeRound) return
    if (!window.confirm(`确定结束「第${activeRound.seq}轮」讨论？结束后学生端将不能再发消息。`)) return
    try {
      const res = await fetch(`/api/teacher/rounds/${activeRound.id}`, {
        method: "PATCH",
        headers: tokenHeader(true),
        body: JSON.stringify({ ended: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "操作失败")
      fetchDashboard()
    } catch (e: any) {
      window.alert(e.message || "操作失败")
    }
  }

  async function handleEndClassroom() {
    const count = materials.length
    const ok = window.confirm(
      `确定结束课堂？结束后讨论关闭，本次上传的 ${count} 份资料会被清除（导出文件不受影响）。`
    )
    if (!ok) return

    await fetch("/api/teacher/classroom/end", {
      method: "POST",
      headers: tokenHeader(true),
      body: JSON.stringify({ currentLessonId }),
    })

    // Fire-and-forget: generate report in background, don't block navigation
    fetch(`/api/reports/generate/${currentLessonId}`, { method: "POST" }).catch(() => {})
    router.push("/teacher/reports")
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-muted-foreground">加载仪表盘...</p>
      </div>
    )
  }

  const shownSummary = summaryTarget
    ? summaryByRound[summaryTarget.id] || summaryTarget.summary || ""
    : ""

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <Link href="/teacher/lessons" className="text-xl font-bold text-indigo-600">
              吾师
            </Link>
            <span className="ml-3 text-sm text-muted-foreground">
              [{data.lesson.subject}] {data.currentLesson.grade}
              {data.currentLesson.className} · {data.lesson.lessonName}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDashboard}>
              刷新数据
            </Button>
            <Button variant="destructive" size="sm" onClick={handleEndClassroom}>
              结束课堂
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Rounds timeline */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base">讨论轮次</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRoundSummary}
                disabled={summaryLoading || !summaryTarget}
              >
                {summaryLoading ? "生成中..." : "生成本轮小结"}
              </Button>
              <Button size="sm" onClick={() => setShowPublish(true)} disabled={!isActive}>
                发布下一轮
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRoundFilter(FILTER_ALL)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs " +
                  (roundFilter === FILTER_ALL
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "bg-white")
                }
                style={btnStyle}
              >
                整节课统计
              </button>
              {rounds.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoundFilter(r.id)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs " +
                    (roundFilter === r.id
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "bg-white")
                  }
                  style={btnStyle}
                >
                  第{r.seq}轮
                  <span className="ml-1 text-[10px] opacity-70">
                    {r.status === "active" ? "进行中" : r.status === "ended" ? "已结束" : "待开始"} ·{" "}
                    {r.messageCount || 0} 条 · {r.materialCount || 0} 份资料
                  </span>
                </button>
              ))}
              {activeRound && (
                <button
                  type="button"
                  onClick={handleEndRound}
                  className="rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-600"
                  style={btnStyle}
                >
                  结束本轮
                </button>
              )}
            </div>

            {shownRound && (
              <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                <p className="font-medium">
                  {roundFilter === FILTER_ALL
                    ? `当前轮（第${shownRound.seq}轮）问题：`
                    : `第${shownRound.seq}轮问题：`}
                  {shownRound.question}
                </p>
                {shownRound.requirements && (
                  <p className="mt-0.5 text-xs text-muted-foreground">讨论要求：{shownRound.requirements}</p>
                )}
                {shownRound.allowSubmit === false && (
                  <p className="mt-1 text-xs text-amber-700">本轮关闭了「自动总结提交」，学生不会被 AI 结束</p>
                )}
              </div>
            )}

            {shownSummary && (
              <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2">
                <p className="mb-1 text-xs font-medium text-indigo-800">
                  第{summaryTarget?.seq}轮小结
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-800">{shownSummary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
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
                {data.totalGroups > 0 ? Math.round((data.submittedGroups / data.totalGroups) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">提交率</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("board")}
            className={
              "rounded-md border px-4 py-1.5 text-sm " +
              (tab === "board" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "bg-white")
            }
            style={btnStyle}
          >
            课堂看板
          </button>
          <button
            type="button"
            onClick={() => setTab("materials")}
            className={
              "rounded-md border px-4 py-1.5 text-sm " +
              (tab === "materials" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "bg-white")
            }
            style={btnStyle}
          >
            本节资料（{materials.length}）
          </button>
        </div>

        {tab === "materials" ? (
          <MaterialManager
            currentLessonId={currentLessonId as string}
            activeRound={activeRound}
            materials={materials}
            rounds={rounds}
            onChanged={fetchDashboard}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: session list + keyword cloud */}
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">小组状态</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {roundFilter === FILTER_ALL ? "整节课" : `第${filteredRound?.seq || "?"}轮`}
                  </span>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="flex min-w-0 items-center gap-3">
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
                        <span className="truncate font-medium">{session.groupName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{session.messageCount} 条消息</span>
                        <span>深度: {"★".repeat(Math.min(Math.floor(session.depthScore / 20), 5)) || "☆"}</span>
                        <button
                          type="button"
                          onClick={() => setGroupModal({ id: session.id, name: session.groupName })}
                          className="rounded border px-2 py-1 text-xs"
                          style={btnStyle}
                        >
                          看对话
                        </button>
                      </div>
                    </div>
                  ))}
                  {data.sessions.length === 0 && (
                    <p className="py-4 text-center text-muted-foreground">等待学生加入...</p>
                  )}
                </CardContent>
              </Card>

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
                        style={{ fontSize: `${Math.max(0.75, Math.min(1.5, kw.count / 10))}rem` }}
                      >
                        {kw.word}
                      </span>
                    ))}
                    {data.keywordCloud.length === 0 && <p className="text-muted-foreground">暂无数据</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: AI Agent Chat */}
            <div>
              <Card className="flex h-full flex-col">
                <CardHeader>
                  <CardTitle className="text-base">AI 课堂助手</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <div className="mb-4 max-h-96 flex-1 space-y-3 overflow-y-auto">
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
                          msg.role === "user" ? "ml-4 bg-indigo-50" : "mr-4 bg-zinc-100"
                        }`}
                      >
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          {msg.role === "user" ? "你" : "AI助教"}
                        </p>
                        {msg.content}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="animate-pulse text-sm text-muted-foreground">AI助教思考中...</div>
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
        )}
      </main>

      {showPublish && (
        <PublishRoundDialog
          currentLessonId={currentLessonId as string}
          lesson={data.lesson as { followUpQuestions?: string[]; coreQuestion?: string }}
          activeRound={activeRound}
          materials={materials}
          onClose={() => setShowPublish(false)}
          onPublished={fetchDashboard}
        />
      )}

      {groupModal && (
        <GroupConversationModal
          sessionId={groupModal.id}
          groupName={groupModal.name}
          rounds={rounds}
          filterRoundId={data.filterRoundId || null}
          onClose={() => setGroupModal(null)}
        />
      )}
    </div>
  )
}
