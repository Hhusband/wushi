import { Server as SocketIOServer } from "socket.io"
import type { Server as HTTPServer } from "http"

let io: SocketIOServer | null = null

export function getIO(): SocketIOServer | null {
  return io
}

export function initSocketServer(httpServer: HTTPServer) {
  if (io) return io

  io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  })

  io.on("connection", (socket) => {
    const { currentLessonId } = socket.handshake.query
    if (currentLessonId && typeof currentLessonId === "string") {
      socket.join(`classroom:${currentLessonId}`)
    }

    socket.on("join:classroom", (lessonId: string) => {
      socket.join(`classroom:${lessonId}`)
    })

    socket.on("join:session", (sessionId: string) => {
      socket.join(`session:${sessionId}`)
    })

    socket.on("disconnect", () => {
      // cleanup handled automatically
    })
  })

  return io
}

export function emitClassroomUpdate(currentLessonId: string, data: Record<string, unknown>) {
  io?.to(`classroom:${currentLessonId}`).emit("classroom:update", data)
}

export function emitSessionUpdate(sessionId: string, data: Record<string, unknown>) {
  io?.to(`session:${sessionId}`).emit("session:update", data)
}

export function emitNewMessage(sessionId: string, message: Record<string, unknown>) {
  io?.to(`session:${sessionId}`).emit("message:new", message)
}
