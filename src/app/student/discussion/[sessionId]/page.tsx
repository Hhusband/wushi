"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

interface Message {
  id: string
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
}

const DEBUG = true

export default function DiscussionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [lesson, setLesson] = useState<LessonInfo | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const endingRef = useRef(false)

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

  useEffect(() => {
    fetch(`/api/student/session/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.session) {
          setSession(data.session)
          setMessages(data.messages || [])
        }
        if (data.lesson) {
          setLesson(data.lesson)
        }
      })
  }, [sessionId])

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

  const btnBase = "h-9 px-4 py-2 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:bg-accent active:text-accent-foreground"

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b bg-white px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div>
            <h1 className="font-medium text-sm">
              {lesson ? lesson.lessonName : "课堂讨论"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {session ? session.groupName : ""}{session ? " · " : ""}{session && session.status === "active" ? "讨论中" : "已结束"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleEndDiscussion}
            onMouseDown={handleEndDiscussion}
            className={btnBase + " border border-input bg-background"}
            style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
          >
            结束讨论
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={"flex " + (msg.role === "student" ? "justify-end" : "justify-start")}
            >
              <div
                className={"max-w-[80%] rounded-lg px-4 py-3 " + (
                  msg.role === "student"
                    ? "bg-indigo-600 text-white"
                    : msg.role === "system"
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-white border"
                )}
              >
                {msg.authorName && (
                  <p className="text-xs opacity-70 mb-1">{msg.authorName}</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-lg px-4 py-3">
                <p className="text-sm text-muted-foreground animate-pulse">
                  AI助教思考中...
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-white px-4 py-3 flex-shrink-0">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend() }}
            placeholder="输入你的想法..."
            disabled={loading || (session ? session.status !== "active" : true)}
          />
          <button
            type="button"
            onClick={handleSend}
            onMouseDown={handleSend}
            disabled={loading || !input.trim() || (session ? session.status !== "active" : true)}
            className={btnBase + " bg-primary text-primary-foreground active:bg-primary/90"}
            style={{ WebkitAppearance: "button", cursor: "pointer", touchAction: "manipulation" }}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
