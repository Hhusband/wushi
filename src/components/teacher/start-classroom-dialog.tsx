"use client"

import { useRef, useState } from "react"
import type { MaterialData } from "@/types"

interface StartClassroomDialogProps {
  lesson: {
    id: string
    grade: string
    className: string
    coreQuestion: string
    discussionRequirements?: string
    followUpQuestions?: string[]
  }
  onClose: () => void
  onStarted: (currentLessonId: string) => void
}

const btnStyle = {
  WebkitAppearance: "button" as const,
  cursor: "pointer",
  touchAction: "manipulation" as const,
}

const IMAGE_RE = /\.(jpe?g|png|webp|gif|heic)$/i

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function StartClassroomDialog({ lesson, onClose, onStarted }: StartClassroomDialogProps) {
  const followUps = (lesson.followUpQuestions || []).filter((q) => typeof q === "string" && q.trim())
  const [question, setQuestion] = useState(lesson.coreQuestion || "")
  const [requirements, setRequirements] = useState(lesson.discussionRequirements || "")
  const [allowSubmit, setAllowSubmit] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [starting, setStarting] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList | null) {
    if (!list) return
    setError(null)
    setFiles((prev) => {
      const merged = [...prev]
      Array.from(list).forEach((f) => {
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f)
      })
      return merged
    })
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function uploadFiles(currentLessonId: string, token: string | null) {
    if (files.length === 0) return
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const images = files.filter((f) => IMAGE_RE.test(f.name))
    const docs = files.filter((f) => !IMAGE_RE.test(f.name))
    const batches: File[][] = []
    for (let i = 0; i < images.length; i += 10) batches.push(images.slice(i, i + 10))
    docs.forEach((d) => batches.push([d]))

    const failures: string[] = []
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      setProgress(`正在上传参考文件（${i + 1}/${batches.length}）…`)
      const form = new FormData()
      batch.forEach((f) => form.append("files", f))
      form.append("push", "1")
      try {
        const res = await fetch(`/api/teacher/classroom/${currentLessonId}/materials`, {
          method: "POST",
          headers,
          body: form,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "上传失败")
        void (json.materials as MaterialData[] | undefined)
      } catch (e: any) {
        failures.push(`${batch.map((f) => f.name).join("、")}：${e.message || "上传失败"}`)
      }
    }
    if (failures.length > 0) {
      alert(`课堂已启动，但以下资料上传失败：\n\n${failures.join("\n")}\n\n可以进入课堂后在「本节资料」里重新上传。`)
    }
  }

  async function handleStart() {
    if (!question.trim()) {
      setError("请填写第一轮讨论问题")
      return
    }
    setError(null)
    setStarting(true)
    try {
      const token = localStorage.getItem("teacher_token")
      setProgress("正在启动课堂…")
      const res = await fetch("/api/teacher/classroom/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          grade: lesson.grade,
          className: lesson.className,
          roundQuestion: question,
          roundRequirements: requirements,
          roundAllowSubmit: allowSubmit,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.currentLesson) throw new Error(json.error || "启动失败")
      await uploadFiles(json.currentLesson.id, token)
      setProgress("")
      onStarted(json.currentLesson.id as string)
    } catch (e: any) {
      setError(e.message || "启动失败")
      setProgress("")
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">启动课堂 · 第一轮讨论</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {lesson.grade} {lesson.className}，学生进入后即看到这一轮的问题和资料。
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm" style={btnStyle}>
            关闭
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">第一轮讨论问题</label>
            {followUps.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {followUps.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuestion(q)}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50"
                    style={btnStyle}
                  >
                    追问 {i + 1}：{q}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="学生第一轮要讨论的问题"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">讨论要求（可选）</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="例如：每组至少举 2 个例子，并说明理由"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium">参考文件（可选）</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded border px-3 py-1 text-xs hover:bg-zinc-50"
                style={btnStyle}
              >
                选择文件
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,image/*"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ""
              }}
            />
            <p className="text-xs text-muted-foreground">
              PDF / Word（.doc/.docx）/ 图片；图片可一次多选（≤10 张）。启动后立即下发给学生。
            </p>
            {files.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                    <span className="min-w-0 truncate">
                      {IMAGE_RE.test(f.name) ? "🖼 " : "📄 "}
                      {f.name} · {fmtBytes(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="ml-2 shrink-0 text-rose-600"
                      style={btnStyle}
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
                还没有添加参考文件
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowSubmit}
              onChange={(e) => setAllowSubmit(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              允许学生在说「没有了」后结束讨论并提交总结
              <span className="block text-xs text-muted-foreground">
                关掉则本轮结束前学生不会被 AI 结束，适合后面还要发布下一轮讨论。
              </span>
            </span>
          </label>

          {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {progress && <p className="text-sm text-muted-foreground">{progress}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm" style={btnStyle}>
              取消
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={btnStyle}
            >
              {starting ? "正在启动…" : "启动课堂并下发"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
