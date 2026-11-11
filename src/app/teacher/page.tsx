"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function TeacherLogin() {
  const [accessCode, setAccessCode] = useState("")
  const [teacherName, setTeacherName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [registeredCode, setRegisteredCode] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("login")
  const [checking, setChecking] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("teacher_token")
    if (!token) return

    setChecking(true)
    fetch("/api/teacher/classroom/active", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.currentLesson) {
          router.push(`/teacher/dashboard/${data.currentLesson.id}`)
        } else {
          router.push("/teacher/lessons")
        }
      })
      .catch(() => {
        localStorage.clear()
        setChecking(false)
      })
  }, [router])

  async function handleLogin() {
    if (!accessCode.trim()) {
      setError("请输入访问码")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/teacher/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "认证失败")
        return
      }

      saveAndRedirect(data)
    } catch {
      setError("网络错误，请重试")
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!teacherName.trim()) {
      setError("请输入您的姓名")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/teacher/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", teacherName: teacherName.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "注册失败")
        return
      }

      setRegisteredCode(data.accessCode)
      setAccessCode(data.accessCode)
      setActiveTab("login")
      setTeacherName("")
    } catch {
      setError("网络错误，请重试")
    } finally {
      setLoading(false)
    }
  }

  function saveAndRedirect(data: { token: string; teacher: { id: string; name: string } }) {
    localStorage.setItem("teacher_token", data.token)
    localStorage.setItem("teacher_name", data.teacher.name)
    localStorage.setItem("teacher_id", data.teacher.id)
    router.push("/teacher/lessons")
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <p className="text-muted-foreground">正在检查登录状态...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">吾师</CardTitle>
          <CardDescription>AI 课堂讨论助手</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">登录</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">注册</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">教师访问码</label>
                <Input
                  type="text"
                  placeholder="请输入您的访问码"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              <Button className="w-full" onClick={handleLogin} disabled={loading}>
                {loading ? "验证中..." : "进入工作台"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                如需访问码，请联系管理员
              </p>
            </TabsContent>

            <TabsContent value="register" className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">您的姓名</label>
                <Input
                  type="text"
                  placeholder="请输入您的真实姓名"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                />
                {registeredCode && (
                  <p className="text-sm text-green-600">
                    注册成功！访问码已自动填入登录栏，请切换至"登录"标签页使用
                  </p>
                )}
              </div>
              <Button className="w-full" onClick={handleRegister} disabled={loading}>
                {loading ? "注册中..." : "注册"}
              </Button>
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
