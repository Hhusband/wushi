"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { MaterialData, RoundData } from "@/types"

interface PublishRoundDialogProps {
  currentLessonId: string
  lesson: { followUpQuestions?: string[]; coreQuestion?: string }
  activeRound: RoundData | null
  materials: MaterialData[]
  onClose: () => void
  onPublished: () => void
}

const btnStyle = {
  WebkitAppearance: "button" as const,
  cursor: "pointer",
  touchAction: "manipulation" as const,
}

export function PublishRoundDialog({
  currentLessonId,
  lesson,
  activeRound,
  materials,
  onClose,
  onPublished,
}: PublishRoundDialogProps) {
  const followUps = useMemo(() => {
    const list = (lesson.followUpQuestions || []).filter((q) => typeof q === "string" && q.trim())
    return list
  }, [lesson.followUpQuestions])

  const [question, setQuestion] = useState("")
  const [requirements, setRequirements] = useState("")
  const [allowSubmit, setAllowSubmit] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allMaterials, setAllMaterials] = useState<MaterialData[]>(materials)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setAllMaterials(materials), [materials])

  const unpushed = allMaterials.filter((m) => !m.pushedAt)

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      const token = localStorage.getItem("teacher_token")
      const form = new FormData()
      Array.from(files).forEach((f) => form.append("files", f))
      const res = await fetch(`/api/teacher/classroom/${currentLessonId}/materials`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "上传失败")
      const created: MaterialData[] = json.materials || []
      setAllMaterials((prev) => [...prev, ...created])
      setSelectedIds((prev) => [...prev, ...created.map((m) => m.id)])
    } catch (e: any) {
      setError(e.message || "上传失败")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handlePublish() {
    if (!question.trim()) {
      setError("请填写本轮讨论问题")
      return
    }
    setError(null)
    setPublishing(true)
    try {
      const token = localStorage.getItem("teacher_token")
      const res = await fetch(`/api/teacher/classroom/${currentLessonId}/rounds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question,
          requirements,
          allowSubmit,
          materialIds: selectedIds,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "发布失败")
      onPublished()
      onClose()
    } catch (e: any) {
      setError(e.message || "发布失败")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">发布下一轮讨论</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              发布后当前轮（{activeRound ? `第${activeRound.seq}轮` : "无"}）将结束，学生端会收到新一轮问题并自动回到讨论状态。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-3 py-1 text-sm"
            style={btnStyle}
          >
            关闭
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">本轮讨论问题</label>
            {followUps.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {followUps.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuestion(q)}
                    className={
                      "max-w-full truncate rounded-full border px-3 py-1 text-xs " +
                      (question === q ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "bg-white")
                    }
                    style={btnStyle}
                    title={q}
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
              placeholder="例如：刚才的结论在生活里还有哪些类似的例子？"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">本轮讨论要求（可选）</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={2}
              placeholder="例如：每组至少举 2 个例子，并说明理由"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">本轮资料（可选）</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,image/*"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="rounded border px-3 py-1 text-xs"
                  style={btnStyle}
                >
                  {uploading ? "上传中…" : "上传新资料"}
                </button>
              </div>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              勾选的资料会随本轮一起下发给学生；PDF/Word 单个 ≤30MB，图片单张 ≤10MB（一次最多 10 张）。
            </p>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
              {unpushed.length === 0 && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  暂无未下发的资料，可直接上传
                </p>
              )}
              {unpushed.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded p-1 text-sm hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={() => toggle(m.id)}
                  />
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600">
                    {m.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.title || m.fileName}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowSubmit} onChange={(e) => setAllowSubmit(e.target.checked)} />
            允许学生在本轮结束讨论并提交总结（关闭后 AI 不会自动总结）
          </label>

          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm"
              style={btnStyle}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={btnStyle}
            >
              {publishing ? "发布中…" : "发布并通知学生"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
