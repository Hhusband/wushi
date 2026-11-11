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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getTeacherId(request)
    const { id } = await params
    const lesson = await lessonRepo.findById(id)
    if (!lesson) return NextResponse.json({ error: "课程不存在" }, { status: 404 })
    return NextResponse.json({ lesson })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getTeacherId(request)
    const { id } = await params
    const body = await request.json()
    const lesson = await lessonRepo.update(id, body)
    return NextResponse.json({ lesson })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getTeacherId(request)
    const { id } = await params
    await lessonRepo.delete(id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}
