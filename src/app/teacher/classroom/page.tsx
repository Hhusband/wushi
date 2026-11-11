"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CurrentLesson {
  id: string
  lessonId: string
  grade: string
  className: string
  status: string
  lesson: { lessonName: string; coreQuestion: string }
}

export default function ClassroomPage() {
  const [currentLesson, setCurrentLesson] = useState<CurrentLesson | null>(null)
  const [loading, setLoading] = useState(true)
  const endingRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("teacher_token")
    if (!token) {
      router.push("/teacher")
      return
    }

    fetch("/api/teacher/classroom/active", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.currentLesson) setCurrentLesson(data.currentLesson)
      })
      .finally(() => setLoading(false))
  }, [router])

  function handleEndClassroom() {
    if (endingRef.current || !currentLesson) return
    endingRef.current = true
    const token = localStorage.getItem("teacher_token")
    if (!token) { endingRef.current = false; return }

    fetch("/api/teacher/classroom/end", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentLessonId: currentLesson.id }),
    })
      .finally(() => {
        setCurrentLesson(null)
        router.push("/teacher/lessons")
      })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/teacher/lessons" className="text-xl font-bold text-indigo-600">
            吾师
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/teacher/lessons">课程列表</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">课堂控制中心</h1>

        {currentLesson ? (
          <Card>
            <CardHeader>
              <CardTitle>当前进行中</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-lg">
                {currentLesson.grade}{currentLesson.className} · {currentLesson.lesson.lessonName}
              </div>
              <p className="text-muted-foreground">{currentLesson.lesson.coreQuestion}</p>
              <div className="flex gap-3">
                <Button asChild>
                  <Link href={`/teacher/dashboard/${currentLesson.id}`}>
                    进入仪表盘
                  </Link>
                </Button>
                <button
                  type="button"
                  onClick={handleEndClassroom}
                  onMouseDown={handleEndClassroom}
                  className="h-10 px-4 py-2 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground active:bg-destructive/90"
                  style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
                >
                  结束课堂
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>当前没有进行中的课堂</p>
              <Button className="mt-4" asChild>
                <Link href="/teacher/lessons">去课程列表启动课堂</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
