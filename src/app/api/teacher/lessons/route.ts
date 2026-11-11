import { NextResponse } from "next/server"
import { verifyToken, extractToken } from "@/lib/auth"
import { lessonRepo } from "@/repositories/lesson"

async function getTeacherId(request: Request): Promise<string> {
  const token = extractToken(request)
  if (!token) throw new Error("未登录")
  const payload = await verifyToken(token)
  if (!payload?.teacherId) throw new Error("未登录")
  return payload.teacherId as string
}

export async function GET(request: Request) {
  try {
    const teacherId = await getTeacherId(request)
    const lessons = await lessonRepo.findAll(teacherId)
    return NextResponse.json({ lessons })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const teacherId = await getTeacherId(request)
    const body = await request.json()
    const lesson = await lessonRepo.create(teacherId, body)
    return NextResponse.json({ lesson }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}
