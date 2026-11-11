import { exportSessionToExcel } from "./excel-exporter"

const pendingExports = new Map<string, ReturnType<typeof setTimeout>>()

export function debouncedExport(sessionId: string, delayMs = 5000) {
  if (pendingExports.has(sessionId)) {
    clearTimeout(pendingExports.get(sessionId)!)
  }
  pendingExports.set(
    sessionId,
    setTimeout(async () => {
      pendingExports.delete(sessionId)
      try {
        await exportSessionToExcel(sessionId)
      } catch (err) {
        console.error(`[export] failed for session ${sessionId}:`, err)
      }
    }, delayMs)
  )
}
