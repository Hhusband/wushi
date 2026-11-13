"use client"

import { useEffect, useMemo, useState } from "react"
import type { MaterialData, RoundData } from "@/types"
import { MaterialViewer } from "@/components/materials/material-viewer"

interface GroupConversationModalProps {
  sessionId: string
  groupName: string
  rounds: RoundData[]
  filterRoundId?: string | null
  onClose: () => void
}

interface Msg {
  id: string
  role: "student" | "assistant" | "system"
  authorName?: string | null
  content: string
  roundId?: string | null
  createdAt: string
}

const btnStyle = { WebkitAppearance: "button" as const, cursor: "pointer", touchAction: "manipulation" as const }

export function GroupConversationModal({
  sessionId,
  groupName,
  rounds,
  filterRoundId,
  onClose,
}: GroupConversationModalProps) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [materials, setMaterials] = useState<MaterialData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [localFilter, setLocalFilter] = useState<string>(filterRoundId || "all")
  const [viewerItems, setViewerItems] = useState<MaterialData[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/student/session/${sessionId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) throw new Error(json.error)
        setMessages((json.messages || []) as Msg[])
        setMaterials((json.materials || []) as MaterialData[])
      })
      .catch((e) => !cancelled && setError(e.message || "加载失败"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const roundLabel = useMemo(() => {
    const map = new Map<string, string>()
    rounds.forEach((r) => map.set(r.id, `第${r.seq}轮`))
    return map
  }, [rounds])

  const visible = useMemo(
    () => (localFilter === "all" ? messages : messages.filter((m) => m.roundId === localFilter)),
    [messages, localFilter]
  )

  const roundMaterials = useMemo(
    () =>
      localFilter === "all"
        ? materials.filter((m) => m.pushedAt)
        : materials.filter((m) => m.pushedAt && m.roundId === localFilter),
    [materials, localFilter]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl bg-white">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{groupName} · 对话</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">按轮次查看这个小组的讨论过程</p>
          </div>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm" style={btnStyle}>
            关闭
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <button
            type="button"
            onClick={() => setLocalFilter("all")}
            className={
              "rounded-full border px-3 py-1 text-xs " +
              (localFilter === "all" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "bg-white")
            }
            style={btnStyle}
          >
            整节课
          </button>
          {rounds.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setLocalFilter(r.id)}
              className={
                "rounded-full border px-3 py-1 text-xs " +
                (localFilter === r.id ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "bg-white")
              }
              style={btnStyle}
            >
              第{r.seq}轮{r.status === "active" ? " · 进行中" : ""}
            </button>
          ))}
        </div>

        {roundMaterials.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b bg-zinc-50 px-4 py-2">
            <span className="mr-1 text-xs text-muted-foreground">本轮资料：</span>
            {roundMaterials.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewerItems([m])}
                className="max-w-[200px] truncate rounded border bg-white px-2 py-0.5 text-xs"
                style={btnStyle}
              >
                {m.kind === "image" ? "🖼 " : "📄 "}
                {m.title || m.fileName}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-zinc-50 p-4">
          {loading && <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>}
          {error && <p className="py-8 text-center text-sm text-red-600">{error}</p>}
          {!loading && !error && visible.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">这一轮还没有消息</p>
          )}
          {visible.map((m, i) => {
            const prev = visible[i - 1]
            const showDivider = m.role !== "system" && m.roundId && (!prev || prev.roundId !== m.roundId)
            return (
              <div key={m.id}>
                {showDivider && (
                  <div className="my-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-px flex-1 bg-zinc-200" />
                    {roundLabel.get(m.roundId as string) || "讨论"}
                    <span className="h-px flex-1 bg-zinc-200" />
                  </div>
                )}
                {m.role === "system" ? (
                  <p className="rounded bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-800">{m.content}</p>
                ) : (
                  <div className={"flex " + (m.role === "student" ? "justify-end" : "justify-start")}>
                    <div
                      className={
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm " +
                        (m.role === "student" ? "bg-indigo-600 text-white" : "border bg-white")
                      }
                    >
                      <p className="mb-0.5 text-[10px] opacity-70">
                        {m.role === "student" ? m.authorName || "学生" : "AI助手"} ·{" "}
                        {new Date(m.createdAt).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {viewerItems && <MaterialViewer items={viewerItems} onClose={() => setViewerItems(null)} />}
    </div>
  )
}
