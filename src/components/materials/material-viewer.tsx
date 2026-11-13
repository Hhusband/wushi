"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { MaterialData } from "@/types"

interface MaterialViewerProps {
  /** 同一次打开的资料集合：图片批次为多张，其它类型为单个 */
  items: MaterialData[]
  onClose: () => void
}

const btnStyle = { WebkitAppearance: "button" as const, cursor: "pointer", touchAction: "manipulation" as const }

export function MaterialViewer({ items, onClose }: MaterialViewerProps) {
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const current = items[index]

  const close = useCallback(() => {
    scrollRef.current = null
    onClose()
  }, [onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  if (!current) return null

  const isImageBatch = items.length > 1 || current.kind === "image"

  function scrollTo(i: number) {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
    setIndex(i)
  }

  function onScroll() {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index) setIndex(Math.max(0, Math.min(items.length - 1, i)))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      <header className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{current.title || current.fileName}</p>
          <p className="truncate text-xs text-white/60">
            {isImageBatch ? `图片 ${index + 1} / ${items.length}` : current.fileName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={current.url}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-white/30 px-3 py-1.5 text-sm"
          >
            新窗口打开
          </a>
          <button
            type="button"
            onClick={close}
            className="rounded bg-white/15 px-3 py-1.5 text-sm"
            style={btnStyle}
          >
            关闭
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {current.kind === "image" ? (
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex h-full snap-x snap-mandatory overflow-x-auto"
            style={{ touchAction: "pan-x pinch-zoom" }}
          >
            {items.map((m) => (
              <div key={m.id} className="flex min-w-full snap-center items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.title || m.fileName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ))}
          </div>
        ) : current.kind === "pdf" ? (
          <iframe
            src={current.url}
            title={current.title || current.fileName}
            className="h-full w-full bg-white"
          />
        ) : current.kind === "docx" ? (
          <DocxViewer url={current.url} />
        ) : (
          <DocFallback title={current.title || current.fileName} url={current.url} />
        )}
      </div>

      {isImageBatch && items.length > 1 && (
        <div className="flex flex-shrink-0 gap-2 overflow-x-auto px-4 py-3">
          {items.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => scrollTo(i)}
              className={
                "h-14 w-14 flex-shrink-0 overflow-hidden rounded border-2 " +
                (i === index ? "border-white" : "border-transparent opacity-60")
              }
              style={btnStyle}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DocxViewer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    const container = ref.current
    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error("下载失败")
        const buffer = await res.arrayBuffer()
        const mod = await import("docx-preview")
        if (cancelled || !container) return
        container.innerHTML = ""
        await mod.renderAsync(buffer, container, undefined, {
          className: "docx-viewer",
          inWrapper: true,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: true,
        })
        if (!cancelled) setState("ready")
      } catch {
        if (!cancelled) setState("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="h-full overflow-y-auto bg-zinc-300">
      {state === "loading" && <p className="p-6 text-center text-sm text-zinc-700">正在加载 Word 文档…</p>}
      {state === "error" && (
        <DocFallback title="Word 文档预览失败" url={url} hint="可以下载后用 WPS / Word 打开" />
      )}
      <div ref={ref} className="docx-host p-3" />
    </div>
  )
}

function DocFallback({ title, url, hint }: { title: string; url: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-white/80">{title}</p>
      <p className="text-xs text-white/50">{hint || "该格式无法直接在线预览，请下载后查看"}</p>
      <a href={url} download className="rounded bg-white px-4 py-2 text-sm font-medium text-zinc-900">
        下载文件
      </a>
    </div>
  )
}
