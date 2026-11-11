import { NextResponse } from "next/server"
import { TeacherAgent } from "@/agents/teacher-agent"
import type { ChatMessage } from "@/types"

export async function POST(request: Request) {
  try {
    const { currentLessonId, message, history } = await request.json()

    if (!currentLessonId || !message) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 })
    }

    const agent = new TeacherAgent(currentLessonId)
    const response = await agent.answer(message, (history as ChatMessage[]) || [])

    return NextResponse.json({ reply: response.content, data: response.data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
