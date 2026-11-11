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

  async function handleSubmit() {
    if (DEBUG) console.log("[SubmissionPage] handleSubmit called")
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    try {
      await fetch(`/api/student/session/${sessionId}/submit`, {
        method: "POST",
      })
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
            <button
              type="button"
              onClick={() => navigate("/student")}
              onMouseDown={() => navigate("/student")}
              className={btnBase + " bg-primary text-primary-foreground active:bg-primary/90"}
              style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
            >
              返回首页
            </button>
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
