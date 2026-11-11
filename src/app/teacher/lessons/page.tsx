"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Lesson {
  id: string
  subject: string
  lessonName: string
  lessonNumber: string
  grade: string
  className: string
  coreQuestion: string
  status: string
  createdAt: string
}

interface ActiveLesson {
  id: string
  grade: string
  className: string
  status: string
  lesson: { subject: string; lessonName: string }
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [teacherName, setTeacherName] = useState("")
  const [activeLesson, setActiveLesson] = useState<ActiveLesson | null>(null)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("teacher_token")
    const name = localStorage.getItem("teacher_name")
    if (!token) {
      router.push("/teacher")
      return
    }
    setTeacherName(name || "教师")

    fetch("/api/teacher/lessons", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.lessons) setLessons(data.lessons)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem("teacher_token")
    if (!token) return

    fetch("/api/teacher/classroom/active", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.currentLesson) setActiveLesson(data.currentLesson)
      })
      .catch(() => {})
  }, [])

  async function handleStartClassroom(lesson: Lesson) {
    const token = localStorage.getItem("teacher_token")
    if (!token) return

    const res = await fetch("/api/teacher/classroom/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lessonId: lesson.id,
        grade: lesson.grade,
        className: lesson.className,
      }),
    })

    const data = await res.json()
    if (data.currentLesson) {
      router.push(`/teacher/dashboard/${data.currentLesson.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/teacher/lessons" className="text-xl font-bold text-indigo-600">
            吾师
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{teacherName}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/teacher/reports">报告中心</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              localStorage.clear()
              router.push("/teacher")
            }}>
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {activeLesson && (
          <div className="mb-6 rounded-lg border-2 border-indigo-200 bg-indigo-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600">进行中的课堂</p>
                <p className="text-lg font-bold text-zinc-900">
                  [{activeLesson.lesson.subject}] {activeLesson.grade}{activeLesson.className}
                </p>
                <p className="text-sm text-muted-foreground">{activeLesson.lesson.lessonName}</p>
              </div>
              <Button
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => router.push(`/teacher/dashboard/${activeLesson.id}`)}
              >
                进入课堂
              </Button>
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">我的课程</h1>
            <p className="text-sm text-muted-foreground">管理讨论任务和课堂</p>
          </div>
          <Button asChild>
            <Link href="/teacher/lessons/new">+ 新建课程</Link>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-24" />
              </Card>
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="mb-4">还没有课程，点击上方按钮创建第一个讨论任务</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson) => (
              <Card key={lesson.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        [{lesson.subject}] {lesson.grade}{lesson.className} · {lesson.lessonNumber} · {lesson.lessonName}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        核心问题: {lesson.coreQuestion}
                      </p>
                    </div>
                    <Badge variant={lesson.status === "published" ? "default" : "secondary"}>
                      {lesson.status === "published" ? "已发布" : "草稿"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleStartClassroom(lesson)}>
                      启动课堂
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/teacher/lessons/${lesson.id}`}>详情</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
