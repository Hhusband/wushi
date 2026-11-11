import { NextResponse } from "next/server"
import { reportRepo } from "@/repositories/report"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const report = await reportRepo.findById(id)
  if (!report) return NextResponse.json({ error: "报告不存在" }, { status: 404 })

  return NextResponse.json({ report })
}
