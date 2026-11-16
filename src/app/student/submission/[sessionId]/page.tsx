"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const DEBUG = true

export default function SubmissionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [summary, setSummary] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const submittingRef = useRef(false)
  const navigatingRef = useRef(false)
  // 老师发布新一轮后，会话会被重置为 active —— 轮询到这里就提示可以返回讨论
  const [sessionActive, setSessionActive] = useState(false)
  const [activeSeq, setActiveSeq] = useState<number | null>(null)

  useEffect(() => {
    function onError(msg: string | Event) {
      if (DEBUG) console.log("[SubmissionPage] JS Error:", msg)
    }
    function onRejection(evt: PromiseRejectionEvent) {
      if (DEBUG) console.log("[SubmissionPage] Promise Error:", evt.reason)
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    if (DEBUG) console.log("[SubmissionPage] mounted, sessionId:", sessionId)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [sessionId])

  useEffect(() => {
    async function generateSummary() {
      try {
        const res = await fetch(`/api/student/session/${sessionId}`)
        const data = await res.json()

        if (data.messages) {
          const discussionContent = data.messages
            .filter((m: any) => m.role !== "system")
            .map((m: any) => "[" + (m.role === "assistant" ? "AI助教" : (m.authorName || "学生")) + "] " + m.content)
            .slice(-20)
            .join("\n\n")

          setSummary(discussionContent || "暂无讨论内容")
        }
      } catch {
        setSummary("无法加载讨论内容")
      }
    }

    generateSummary()
  }, [sessionId])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null

    async function checkRound() {
      try {
        const res = await fetch(`/api/student/session/${sessionId}`, { cache: "no-store" })
        const data = await res.json()
        if (!alive) return
        setSessionActive(data.session?.status === "active")
        const rounds: any[] = data.rounds || []
        const current = rounds.find((r: any) => r.id === data.activeRoundId)
        setActiveSeq(current?.seq ?? null)
      } catch {
        if (DEBUG) console.log("[SubmissionPage] 检查轮次状态失败")
      }
      if (alive) timer = setTimeout(checkRound, 5000)
    }

    checkRound()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [sessionId])

  async function handleSubmit() {
    if (DEBUG) console.log("[SubmissionPage] handleSubmit called")
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    try {
      await fetch(`/api/student/session/${sessionId}/submit`, {
        method: "POST",
      })
      // 提交后本组进入「已提交」状态：先清掉旧的 active 标记，避免停留页误报「已发布新一轮」
      setSessionActive(false)
      setActiveSeq(null)
      setSubmitted(true)
    } catch {
      alert("提交失败，请重试")
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  const btnBase = "h-10 px-4 py-2 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:bg-accent active:text-accent-foreground"

  function navigate(to: string) {
    if (navigatingRef.current) return
    navigatingRef.current = true
    router.push(to)
  }

  function goBack() {
    if (navigatingRef.current) return
    navigatingRef.current = true
    router.back()
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-white p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12 space-y-4">
            <div className="text-4xl">🎉</div>
            <h2 className="text-xl font-bold">提交成功！</h2>
            <p className="text-muted-foreground">你们的讨论成果已经提交给老师</p>
            {sessionActive ? (
              <>
                <p className="rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                  老师已发布{activeSeq ? `第 ${activeSeq} 轮` : "新一轮"}讨论，可以继续讨论了
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/student/discussion/${sessionId}`)}
                  onMouseDown={() => navigate(`/student/discussion/${sessionId}`)}
                  className={btnBase + " w-full bg-primary text-primary-foreground active:bg-primary/90"}
                  style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
                >
                  返回继续讨论
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/student")}
                  onMouseDown={() => navigate("/student")}
                  className={btnBase + " w-full border border-input bg-background active:bg-accent"}
                  style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
                >
                  返回首页
                </button>
              </>
            ) : (
              <>
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  老师发布新一轮讨论后，这里会自动出现「返回继续讨论」按钮（也可以从首页重新进入本课堂）
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/student")}
                  onMouseDown={() => navigate("/student")}
                  className={btnBase + " bg-primary text-primary-foreground active:bg-primary/90"}
                  style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
                >
                  返回首页
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-medium">确认提交讨论成果</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">你们的讨论总结</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans text-sm">{summary}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              确认后将提交给老师，老师会看到你们小组的完整讨论过程和成果。
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={goBack}
                onMouseDown={goBack}
                className={btnBase + " border border-input bg-background active:bg-accent"}
                style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
              >
                返回继续讨论
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                onMouseDown={handleSubmit}
                disabled={loading}
                className={btnBase + " bg-primary text-primary-foreground active:bg-primary/90"}
                style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
              >
                {loading ? "提交中..." : "确认提交"}
              </button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
