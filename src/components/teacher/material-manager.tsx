"use client"

import { useMemo, useRef, useState } from "react"
import type { MaterialData, RoundData } from "@/types"
import { MaterialViewer } from "@/components/materials/material-viewer"

interface MaterialManagerProps {
  currentLessonId: string
  activeRound: RoundData | null
  materials: MaterialData[]
  rounds: RoundData[]
  onChanged: () => void
}

const btnStyle = {
  WebkitAppearance: "button" as const,
  cursor: "pointer",
  touchAction: "manipulation" as const,
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function MaterialManager({
  currentLessonId,
  activeRound,
  materials,
  rounds,
  onChanged,
}: MaterialManagerProps) {
  const [title, setTitle] = useState("")
  const [pushNow, setPushNow] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerItems, setViewerItems] = useState<MaterialData[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const batches = useMemo(() => {
    const list: { key: string; items: MaterialData[] }[] = []
    for (const m of materials) {
      const key = m.batchId || m.id
      const existing = list.find((b) => b.key === key)
      if (existing) existing.items.push(m)
      else list.push({ key, items: [m] })
    }
    return list
  }, [materials])

  function authHeaders(json = false): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem("teacher_token") : null
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (json) headers["Content-Type"] = "application/json"
    return headers
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      Array.from(files).forEach((f) => form.append("files", f))
      if (title.trim()) form.append("title", title.trim())
      if (pushNow && activeRound) {
        form.append("push", "1")
        form.append("roundId", activeRound.id)
      }
      const res = await fetch(`/api/teacher/classroom/${currentLessonId}/materials`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "上传失败")
      setTitle("")
      onChanged()
    } catch (e: any) {
      setError(e.message || "上传失败")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function updateMaterial(id: string, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/teacher/materials/${id}`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "操作失败")
      onChanged()
    } catch (e: any) {
      setError(e.message || "操作失败")
    }
  }

  async function removeMaterial(m: MaterialData) {
    if (!window.confirm(`确定删除「${m.title || m.fileName}」？`)) return
    try {
      const res = await fetch(`/api/teacher/materials/${m.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "删除失败")
      onChanged()
    } catch (e: any) {
      setError(e.message || "删除失败")
    }
  }

  async function renameMaterial(m: MaterialData) {
    const next = window.prompt("修改资料标题", m.title || m.fileName)
    if (next === null) return
    await updateMaterial(m.id, { title: next })
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium">上传资料</label>
          <span className="text-xs text-muted-foreground">
            PDF / Word（.doc/.docx）/ 图片；图片可一次多选（≤10 张）
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="资料标题（可选，图片批次共用一个标题）"
            className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={pushNow} onChange={(e) => setPushNow(e.target.checked)} />
            上传后立即下发给当前轮
          </label>
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
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={btnStyle}
          >
            {uploading ? "上传中…" : "选择文件"}
          </button>
        </div>
        {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* List */}
      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-medium">本节资料（{materials.length}）</h3>
          <span className="text-xs text-muted-foreground">课堂结束后资料会自动清除</span>
        </div>
        <div className="divide-y">
          {batches.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">还没有上传资料</p>
          )}
          {batches.map((b) => {
            const first = b.items[0]
            const isImages = first.kind === "image"
            const round = first.roundId ? rounds.find((r) => r.id === first.roundId) : null
            return (
              <div key={b.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setViewerItems(b.items)}
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100"
                  style={btnStyle}
                >
                  {isImages ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={first.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-medium uppercase text-zinc-500">{first.kind}</span>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{first.title || first.fileName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {isImages ? `图片 × ${b.items.length}` : first.kind.toUpperCase()} · {fmtSize(first.sizeBytes)}
                    {round ? ` · 第${round.seq}轮` : " · 未分配轮次"}
                  </p>
                </div>

                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                    (first.pushedAt ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-600")
                  }
                >
                  {first.pushedAt ? "已下发" : "未下发"}
                </span>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewerItems(b.items)}
                    className="rounded border px-2 py-1"
                    style={btnStyle}
                  >
                    查看
                  </button>
                  <button
                    type="button"
                    onClick={() => renameMaterial(first)}
                    className="rounded border px-2 py-1"
                    style={btnStyle}
                  >
                    改名
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateMaterial(first.id, { push: !first.pushedAt, unpush: !!first.pushedAt })
                    }
                    className="rounded border px-2 py-1"
                    style={btnStyle}
                  >
                    {first.pushedAt ? "撤回" : "下发"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMaterial(first)}
                    className="rounded border border-red-200 px-2 py-1 text-red-600"
                    style={btnStyle}
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {viewerItems && <MaterialViewer items={viewerItems} onClose={() => setViewerItems(null)} />}
    </div>
  )
}
