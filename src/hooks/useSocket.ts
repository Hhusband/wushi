"use client"

import { useEffect, useRef, useCallback } from "react"
import { io, Socket } from "socket.io-client"

export function useSocket(url?: string) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io(url || "", {
      path: "/api/socket",
      transports: ["websocket", "polling"],
    })
    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [url])

  const joinClassroom = useCallback((lessonId: string) => {
    socketRef.current?.emit("join:classroom", lessonId)
  }, [])

  const joinSession = useCallback((sessionId: string) => {
    socketRef.current?.emit("join:session", sessionId)
  }, [])

  const onClassroomUpdate = useCallback(
    (handler: (data: Record<string, unknown>) => void) => {
      socketRef.current?.on("classroom:update", handler)
      return () => {
        socketRef.current?.off("classroom:update", handler)
      }
    },
    []
  )

  const onSessionUpdate = useCallback(
    (handler: (data: Record<string, unknown>) => void) => {
      socketRef.current?.on("session:update", handler)
      return () => {
        socketRef.current?.off("session:update", handler)
      }
    },
    []
  )

  const onNewMessage = useCallback(
    (handler: (message: Record<string, unknown>) => void) => {
      socketRef.current?.on("message:new", handler)
      return () => {
        socketRef.current?.off("message:new", handler)
      }
    },
    []
  )

  return { joinClassroom, joinSession, onClassroomUpdate, onSessionUpdate, onNewMessage }
}
