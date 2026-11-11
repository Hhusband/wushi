import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken } from "@/lib/auth"
import { ACCESS_CODES, TEACHER_ACCESS_MAP } from "@/lib/constants"
import { v4 as uuid } from "uuid"

async function createTeacherSession(teacherId: string, teacherName: string) {
  await prisma.teacherAccess.update({
    where: { id: teacherId },
    data: { lastUsedAt: new Date() },
  })

  const token = await signToken({ teacherId, teacherName })
  return { token, teacher: { id: teacherId, name: teacherName } }
}

export async function POST(request: Request) {
  try {
    const { accessCode, teacherName, action } = await request.json()

    // Registration: create a new teacher with auto-generated code
    if (action === "register") {
      if (!teacherName?.trim()) {
        return NextResponse.json({ error: "请输入您的姓名" }, { status: 400 })
      }

      // Check if teacher name already has a code
      const existingName = Object.entries(TEACHER_ACCESS_MAP).find(
        ([name]) => name === teacherName.trim()
      )
      if (existingName) {
        // Already in the map, just use existing code
        let teacherAccess = await prisma.teacherAccess.findUnique({
          where: { accessCode: existingName[1] },
        })
        if (!teacherAccess) {
          teacherAccess = await prisma.teacherAccess.create({
            data: { accessCode: existingName[1], teacherName: teacherName.trim() },
          })
        }
        const result = await createTeacherSession(teacherAccess.id, teacherAccess.teacherName)
        return NextResponse.json({ ...result, accessCode: existingName[1] })
      }

      // Generate new access code
      const newCode = `T${uuid().slice(0, 7).toUpperCase()}`
      const teacherAccess = await prisma.teacherAccess.create({
        data: {
          accessCode: newCode,
          teacherName: teacherName.trim(),
        },
      })

      const result = await createTeacherSession(teacherAccess.id, teacherAccess.teacherName)
      return NextResponse.json({ ...result, accessCode: newCode })
    }

    // Login with access code
    if (!accessCode) {
      return NextResponse.json({ error: "请输入访问码" }, { status: 400 })
    }

    // Find teacher by access code in database
    let teacherAccess = await prisma.teacherAccess.findUnique({
      where: { accessCode },
    })

    // If not in DB but in predefined list, create the record
    if (!teacherAccess && ACCESS_CODES.includes(accessCode)) {
      const teacherEntry = Object.entries(TEACHER_ACCESS_MAP).find(
        ([, code]) => code === accessCode
      )
      const name = teacherEntry?.[0] || `教师_${accessCode.slice(-4)}`

      teacherAccess = await prisma.teacherAccess.create({
        data: { accessCode, teacherName: name },
      })
    }

    if (!teacherAccess) {
      return NextResponse.json({ error: "访问码无效" }, { status: 401 })
    }

    const result = await createTeacherSession(teacherAccess.id, teacherAccess.teacherName)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
