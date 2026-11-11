"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Lesson {
  id: string
  subject: string
  grade: string
  className: string
  lessonNumber: string
  lessonName: string
  coreQuestion: string
  followUpQuestions: string[]
  discussionRequirements: string
  status: string
  createdAt: string
}

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("teacher_token")
    if (!token) {
      router.push("/teacher")
      return
    }

    fetch(`/api/teacher/lessons/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.lesson) setLesson(data.lesson)
      })
      .finally(() => setLoading(false))
  }, [id, router])

  async function handleStartClassroom() {
    if (!lesson) return
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-muted-foreground">课程不存在</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4">
          <Link href="/teacher/lessons" className="text-sm text-muted-foreground hover:text-foreground">
            ← 返回课程列表
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{lesson.lessonName}</CardTitle>
              <Badge variant={lesson.status === "published" ? "default" : "secondary"}>
                {lesson.status === "published" ? "已发布" : "草稿"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">学科:</span> {lesson.subject}
              </div>
              <div>
                <span className="text-muted-foreground">年级:</span> {lesson.grade}
              </div>
              <div>
                <span className="text-muted-foreground">班级:</span> {lesson.className}
              </div>
              <div>
                <span className="text-muted-foreground">课号:</span> {lesson.lessonNumber}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-1">核心问题</h3>
              <p className="text-muted-foreground">{lesson.coreQuestion}</p>
            </div>

            {Array.isArray(lesson.followUpQuestions) && lesson.followUpQuestions.length > 0 && (
              <div>
                <h3 className="font-medium mb-1">追问问题</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {lesson.followUpQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {lesson.discussionRequirements && (
              <div>
                <h3 className="font-medium mb-1">讨论要求</h3>
                <p className="text-muted-foreground">{lesson.discussionRequirements}</p>
              </div>
            )}

            <div className="pt-4">
              <Button onClick={handleStartClassroom}>启动课堂</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
