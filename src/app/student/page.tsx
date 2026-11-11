"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const GRADES = ["一年级","二年级","三年级","四年级","五年级","六年级","七年级","八年级","九年级"]
const CLASSES = ["一班","二班","三班","四班","五班","六班"]
const GROUPS = Array.from({ length: 15 }, (_, i) => `第${i + 1}组`)

const DEBUG = true

export default function StudentPage() {
  const [form, setForm] = useState({
    grade: "四年级",
    className: "三班",
    group: "第2组",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const joiningRef = useRef(false)

  // Global JS error & unhandled rejection capture for iPad Safari debugging
  useEffect(() => {
    function onError(msg: string | Event, source?: string, lineno?: number, colno?: number, err?: Error) {
      if (DEBUG) setError("[JS Error] " + (err?.message || String(msg)).slice(0, 80))
    }
    function onRejection(evt: PromiseRejectionEvent) {
      if (DEBUG) setError("[Promise Error] " + String(evt.reason).slice(0, 80))
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    if (DEBUG) console.log("[StudentPage] mounted, userAgent:", navigator.userAgent)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  async function handleJoin(e?: React.MouseEvent | React.PointerEvent) {
    if (DEBUG) console.log("[StudentPage] handleJoin called, event type:", e?.type)
    if (joiningRef.current) {
      if (DEBUG) console.log("[StudentPage] handleJoin blocked by ref guard")
      return
    }
    joiningRef.current = true

    if (!form.grade || !form.className || !form.group) {
      setError("请填写完整的班级和小组信息")
      joiningRef.current = false
      return
    }

    const groupNumber = parseInt(form.group.replace(/[^0-9]/g, ""), 10)

    setLoading(true)
    setError("")

    try {
      if (DEBUG) console.log("[StudentPage] fetching /api/student/session/join")
      const res = await fetch("/api/student/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: form.grade,
          className: form.className,
          groupNumber,
          groupName: form.group,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (DEBUG) console.log("[StudentPage] join failed:", data.error)
        setError(data.error || "加入失败")
        return
      }

      if (DEBUG) console.log("[StudentPage] join success, navigating to discussion")
      router.push(`/student/discussion/${data.session.id}`)
    } catch (err) {
      if (DEBUG) console.log("[StudentPage] network error:", err)
      setError("网络错误，请重试")
    } finally {
      setLoading(false)
      joiningRef.current = false
    }
  }

  function handleSelectChange(field: "grade" | "className" | "group") {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setForm({ ...form, [field]: e.target.value })
      e.target.blur()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">课堂讨论</CardTitle>
          <CardDescription>加入你的小组讨论</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">年级</label>
            <select
              value={form.grade}
              onChange={handleSelectChange("grade")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">班级</label>
            <select
              value={form.className}
              onChange={handleSelectChange("className")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">小组</label>
            <select
              value={form.group}
              onChange={handleSelectChange("group")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-destructive break-all">{error}</p>}

          {/* Plain native button — avoids shadcn forwardRef + Radix Slot overhead on iOS WebKit */}
          <button
            type="button"
            disabled={loading}
            onClick={handleJoin}
            onMouseDown={handleJoin}
            className="w-full h-10 px-4 py-2 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground active:bg-primary/90"
            style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
          >
            {loading ? "加入中..." : "进入讨论"}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            请确认老师已经启动了课堂
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
