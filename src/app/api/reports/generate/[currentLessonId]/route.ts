import { NextResponse } from "next/server"
import { ReportAgent } from "@/agents/report-agent"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ currentLessonId: string }> }
) {
  try {
    const { currentLessonId } = await params

    const agent = new ReportAgent(currentLessonId)
    const report = await agent.generate()

    return NextResponse.json({ report })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
