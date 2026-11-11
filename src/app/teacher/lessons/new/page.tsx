"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const SUBJECTS = ["语文", "数学", "科学", "道法"]
const GRADES = ["一年级","二年级","三年级","四年级","五年级","六年级","七年级","八年级","九年级"]
const CLASSES = ["一班","二班","三班","四班","五班","六班"]

export default function NewLessonPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    subject: "语文",
    grade: "四年级",
    className: "三班",
    lessonNumber: "第三课",
    lessonName: "诺曼底号遇难记",
    coreQuestion: "哈尔威船长是一个怎样的人？",
    followUpQuestions: "从哪些描写可以看出船长的品质？\n为什么船长选择与船共存亡？",
    discussionRequirements: "请结合课文具体语句进行分析",
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(status: "draft" | "published") {
    const token = localStorage.getItem("teacher_token")
    if (!token) {
      router.push("/teacher")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/teacher/lessons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: form.subject,
          grade: form.grade,
          className: form.className,
          lessonNumber: form.lessonNumber,
          lessonName: form.lessonName,
          coreQuestion: form.coreQuestion,
          followUpQuestions: form.followUpQuestions
            .split("\n")
            .filter((q) => q.trim()),
          discussionRequirements: form.discussionRequirements,
        }),
      })

      const data = await res.json()
      if (data.lesson) {
        if (status === "published") {
          // Start classroom directly
          const cr = await fetch("/api/teacher/classroom/start", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              lessonId: data.lesson.id,
              grade: data.lesson.grade,
              className: data.lesson.className,
            }),
          })
          const cd = await cr.json()
          if (cd.currentLesson) {
            router.push(`/teacher/dashboard/${cd.currentLesson.id}`)
            return
          }
        }
        router.push("/teacher/lessons")
      }
    } finally {
      setLoading(false)
    }
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
            <CardTitle>新建讨论任务</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">学科</label>
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">年级</label>
                <select
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, className: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">课号</label>
                <Input
                  value={form.lessonNumber}
                  onChange={(e) => setForm({ ...form, lessonNumber: e.target.value })}
                  placeholder="第三课"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">课文名称</label>
                <Input
                  value={form.lessonName}
                  onChange={(e) => setForm({ ...form, lessonName: e.target.value })}
                  placeholder="诺曼底号遇难记"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">核心问题</label>
              <Textarea
                value={form.coreQuestion}
                onChange={(e) => setForm({ ...form, coreQuestion: e.target.value })}
                placeholder="哈尔威船长是一个怎样的人？"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">追问问题（每行一个）</label>
              <Textarea
                value={form.followUpQuestions}
                onChange={(e) => setForm({ ...form, followUpQuestions: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">讨论要求</label>
              <Textarea
                value={form.discussionRequirements}
                onChange={(e) => setForm({ ...form, discussionRequirements: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => handleSubmit("draft")}
                disabled={loading}
              >
                保存草稿
              </Button>
              <Button
                onClick={() => handleSubmit("published")}
                disabled={loading}
              >
                发布并启动课堂
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
