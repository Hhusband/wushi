"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { MaterialViewer } from "@/components/materials/material-viewer"
import type { MaterialData, RoundData } from "@/types"

interface Message {
  id: string
  roundId?: string | null
  role: string
  authorName?: string
  content: string
  createdAt: string
}

interface SessionInfo {
  id: string
  groupName: string
  status: string
}

interface LessonInfo {
  lessonName: string
  coreQuestion: string
  followUpQuestions?: string[]
  discussionRequirements?: string
}

const DEBUG = true

const btnBase =
  "h-9 px-4 py-2 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:bg-accent active:text-accent-foreground"
const btnStyle = {
  WebkitAppearance: "button" as const,
  cursor: "pointer",
  touchAction: "manipulation" as const,
}

export default function DiscussionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [lesson, setLesson] = useState<LessonInfo | null>(null)
  const [rounds, setRounds] = useState<RoundData[]>([])
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)
  const [materials, setMaterials] = useState<MaterialData[]>([])
  const [viewerItems, setViewerItems] = useState<MaterialData[] | null>(null)
  const [showRoundInfo, setShowRoundInfo] = useState(false)
  const [showMaterials, setShowMaterials] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const endingRef = useRef(false)

  const activeRound = useMemo(
    () => rounds.find((r) => r.id === activeRoundId) || rounds.find((r) => r.status === "active") || null,
    [rounds, activeRoundId]
  )

  // Global error capture
  useEffect(() => {
    function onError(msg: string | Event) {
      if (DEBUG) console.log("[DiscussionPage] JS Error:", msg)
    }
    function onRejection(evt: PromiseRejectionEvent) {
      if (DEBUG) console.log("[DiscussionPage] Promise Error:", evt.reason)
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    if (DEBUG) console.log("[DiscussionPage] mounted, sessionId:", sessionId)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [sessionId])

  const applyData = useCallback((data: any) => {
    if (data.session) setSession(data.session)
    if (data.messages) setMessages(data.messages)
    if (data.lesson) setLesson(data.lesson)
    if (data.rounds) setRounds(data.rounds)
    if (data.activeRoundId !== undefined) setActiveRoundId(data.activeRoundId ?? null)
    if (data.materials) setMaterials(data.materials)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/student/session/${sessionId}`, { cache: "no-store" })
      const data = await res.json()
      applyData(data)
    } catch {
      // ignore
    }
  }, [sessionId, applyData])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 8000)
    return () => clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    messagesEndRef.current && messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend() {
    if (DEBUG) console.log("[DiscussionPage] handleSend called")
    if (sendingRef.current) return
    if (!input.trim() || loading) return

    sendingRef.current = true
    const content = input
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/student/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, content }),
      })

      const data = await res.json()

      if (data.userMessage) {
        setMessages((prev) => [...prev, data.userMessage])
      }
      if (data.aiResponse) {
        setMessages((prev) => [...prev, data.aiResponse])
      }
      if (data.autoSubmitted) {
        setTimeout(() => router.push(`/student/submission/${sessionId}`), 800)
      }
    } catch (err) {
      if (DEBUG) console.log("[DiscussionPage] send error:", err)
    } finally {
      setLoading(false)
      sendingRef.current = false
    }
  }

  function handleEndDiscussion() {
    if (DEBUG) console.log("[DiscussionPage] handleEndDiscussion called")
    if (endingRef.current) return
    endingRef.current = true
    router.push(`/student/submission/${sessionId}`)
  }

  // 资料按轮次分组：本轮在前、往轮在后
  const materialsByRound = useMemo(() => {
    const groups = new Map<string, MaterialData[]>()
    for (const m of materials) {
      const key = m.roundId || "none"
      const list = groups.get(key) || []
      list.push(m)
      groups.set(key, list)
    }
    const ordered: { round: RoundData | null; items: MaterialData[] }[] = []
    for (const r of [...rounds].reverse()) {
      const items = groups.get(r.id)
      if (items && items.length > 0) ordered.push({ round: r, items })
    }
    const orphans = groups.get("none")
    if (orphans && orphans.length > 0) ordered.push({ round: null, items: orphans })
    return ordered
  }, [materials, rounds])

  function openMaterial(m: MaterialData) {
    // 图片同批共享 batchId：一次打开整批
    const batch = m.batchId ? materials.filter((x) => x.batchId === m.batchId) : [m]
    setViewerItems(batch)
  }

  const roundSeqById = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rounds) map.set(r.id, r.seq)
    return map
  }, [rounds])

  const canInteract = session ? session.status === "active" : false
  const hasMaterials = materials.length > 0

  const materialsPanel = (
    <MaterialsPanel
      groups={materialsByRound}
      activeRoundId={activeRoundId}
      onOpen={openMaterial}
      compact={false}
    />
  )

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-medium">{lesson ? lesson.lessonName : "课堂讨论"}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {session ? session.groupName : ""}
              {session ? " · " : ""}
              {session && session.status === "active"
                ? "讨论中"
                : session && session.status === "submitted"
                  ? "已提交 · 等待老师"
                  : "已结束"}
              {activeRound ? ` · 第${activeRound.seq}轮` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {activeRound && (
              <button
                type="button"
                onClick={() => setShowRoundInfo(true)}
                className="whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                style={btnStyle}
              >
                第{activeRound.seq}轮 · 任务
              </button>
            )}
            {hasMaterials && (
              <button
                type="button"
                onClick={() => setShowMaterials(true)}
                className="whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium lg:hidden"
                style={btnStyle}
              >
                资料 {materials.length}
              </button>
            )}
            <button
              type="button"
              onClick={handleEndDiscussion}
              onMouseDown={handleEndDiscussion}
              disabled={!canInteract}
              className="whitespace-nowrap rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium disabled:opacity-50"
              style={btnStyle}
            >
              结束讨论
            </button>
          </div>
        </div>
        {activeRound && (
          <div className="mx-auto mt-2 max-w-6xl">
            <p className="line-clamp-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">本轮问题：</span>
              {activeRound.question}
            </p>
          </div>
        )}
        {!canInteract && session?.status === "submitted" && (
          <div className="mx-auto mt-2 max-w-6xl">
            <p className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
              本轮已提交。老师发布下一轮讨论后，这里会自动恢复输入框，无需重新进入。
            </p>
          </div>
        )}
      </header>

      {/* Body：横屏左右分栏，竖屏仅为聊天 */}
      <div className="flex min-h-0 min-w-0 flex-1 landscape:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg, i) => {
                const prev = messages[i - 1]
                const showDivider =
                  msg.roundId && msg.roundId !== (prev?.roundId || null) && roundSeqById.get(msg.roundId)
                return (
                  <div key={msg.id}>
                    {showDivider && (
                      <div className="my-4 flex items-center gap-3">
                        <div className="h-px flex-1 bg-zinc-200" />
                        <span className="text-xs font-medium text-zinc-500">
                          第{roundSeqById.get(msg.roundId as string)}轮讨论
                        </span>
                        <div className="h-px flex-1 bg-zinc-200" />
                      </div>
                    )}
                    <div className={"flex " + (msg.role === "student" ? "justify-end" : "justify-start")}>
                      <div
                        className={
                          "max-w-[80%] break-words rounded-lg px-4 py-3 " +
                          (msg.role === "student"
                            ? "bg-indigo-600 text-white"
                            : msg.role === "system"
                              ? "border border-amber-200 bg-amber-50"
                              : "border bg-white")
                        }
                      >
                        {msg.authorName && <p className="mb-1 text-xs opacity-70">{msg.authorName}</p>}
                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-lg border bg-white px-4 py-3">
                    <p className="animate-pulse text-sm text-muted-foreground">AI助教思考中...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t bg-white px-4 py-3">
            <div className="mx-auto flex max-w-3xl gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend()
                }}
                placeholder="输入你的想法..."
                disabled={loading || !canInteract}
              />
              <button
                type="button"
                onClick={handleSend}
                onMouseDown={handleSend}
                disabled={loading || !input.trim() || !canInteract}
                className={btnBase + " bg-primary text-primary-foreground active:bg-primary/90"}
                style={btnStyle}
              >
                发送
              </button>
            </div>
          </div>
        </div>

        {/* 横屏：右侧资料栏 */}
        {hasMaterials && (
          <aside className="hidden w-[36%] min-w-[300px] max-w-md flex-col border-l bg-white landscape:flex">
            <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-medium">资料</h2>
              <span className="text-xs text-muted-foreground">共 {materials.length} 份</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{materialsPanel}</div>
          </aside>
        )}
      </div>

      {/* 竖屏：资料抽屉 */}
      {showMaterials && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/40" onClick={() => setShowMaterials(false)}>
          <div
            className="mt-auto flex max-h-[75vh] flex-col rounded-t-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-medium">本轮资料</h2>
              <button
                type="button"
                onClick={() => setShowMaterials(false)}
                className="rounded border px-3 py-1 text-sm"
                style={btnStyle}
              >
                关闭
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{materialsPanel}</div>
          </div>
        </div>
      )}

      {/* 本轮任务详情 */}
      {showRoundInfo && activeRound && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-lg rounded-xl bg-white p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-base font-medium">第{activeRound.seq}轮讨论任务</h2>
              <button
                type="button"
                onClick={() => setShowRoundInfo(false)}
                className="rounded border px-3 py-1 text-sm"
                style={btnStyle}
              >
                关闭
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm font-medium">{activeRound.question}</p>
            {activeRound.requirements && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                讨论要求：{activeRound.requirements}
              </p>
            )}
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-muted-foreground">
              讨论会分多轮进行，老师会随时发布下一轮问题。本轮资料可在讨论页右侧（横屏）或「资料」按钮（竖屏）查看。
            </div>
          </div>
        </div>
      )}

      {viewerItems && <MaterialViewer items={viewerItems} onClose={() => setViewerItems(null)} />}
    </div>
  )
}

function MaterialsPanel({
  groups,
  activeRoundId,
  onOpen,
}: {
  groups: { round: RoundData | null; items: MaterialData[] }[]
  activeRoundId: string | null
  onOpen: (m: MaterialData) => void
  compact: boolean
}) {
  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">本轮暂无资料</p>
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const batches: { key: string; items: MaterialData[] }[] = []
        for (const m of g.items) {
          const key = m.batchId || m.id
          const existing = batches.find((b) => b.key === key)
          if (existing) existing.items.push(m)
          else batches.push({ key, items: [m] })
        }
        const isCurrent = g.round?.id === activeRoundId
        return (
          <div key={g.round?.id || "none"}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {g.round ? `第${g.round.seq}轮` : "资料"}
              </span>
              {isCurrent && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                  本轮
                </span>
              )}
            </div>
            <div className="space-y-2">
              {batches.map((b) => (
                <MaterialCard key={b.key} items={b.items} onOpen={onOpen} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MaterialCard({ items, onOpen }: { items: MaterialData[]; onOpen: (m: MaterialData) => void }) {
  const first = items[0]
  const isImages = first.kind === "image"
  const label =
    first.kind === "pdf"
      ? "PDF"
      : first.kind === "docx"
        ? "Word"
        : first.kind === "doc"
          ? "Word(doc)"
          : `图片 × ${items.length}`

  return (
    <button
      type="button"
      onClick={() => onOpen(first)}
      className="flex w-full items-center gap-3 rounded-lg border bg-white p-2 text-left active:bg-zinc-50"
      style={btnStyle}
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100">
        {isImages ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={first.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-medium text-zinc-500">{label.split(" ")[0]}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{first.title || first.fileName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {label}
          {isImages ? ` · 共 ${items.length} 张` : ""}
        </p>
      </div>
    </button>
  )
}
