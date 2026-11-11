import { NextResponse } from "next/server"
import { reportRepo } from "@/repositories/report"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const teacherId = searchParams.get("teacherId") || undefined

  const reports = await reportRepo.findAll(teacherId)
  return NextResponse.json({ reports })
}
