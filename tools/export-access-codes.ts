import ExcelJS from "exceljs"
import fs from "fs"
import path from "path"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@db:5432/classroom_ai",
  }),
} as any)

// Predefined access codes from constants
const PREDEFINED: Record<string, string> = {
  "张老师": "TEACHER2024",
  "李老师": "TEACHER07A8",
  "王老师": "TEACHER31B2",
  "赵老师": "TEACHER65C9",
  "刘老师": "TEACHER28D4",
  "陈老师": "TEACHER19E7",
  "杨老师": "TEACHER44F1",
  "黄老师": "TEACHER52G3",
  "周老师": "TEACHER77H6",
  "吴老师": "TEACHER88J5",
}

async function main() {
  // Fetch all registered teacher access records from DB
  const dbRecords = await prisma.teacherAccess.findMany({
    orderBy: { createdAt: "asc" },
  })

  const wb = new ExcelJS.Workbook()
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } },
    alignment: { horizontal: "center", vertical: "middle" },
  }

  // ---- Sheet 1: All codes (predefined + DB registered) ----
  const ws1 = wb.addWorksheet("全部访问码")
  ws1.columns = [
    { header: "类型", key: "type", width: 14 },
    { header: "教师姓名", key: "name", width: 16 },
    { header: "访问码", key: "code", width: 20 },
    { header: "状态", key: "status", width: 10 },
    { header: "注册时间", key: "registeredAt", width: 22 },
    { header: "最后使用", key: "lastUsed", width: 22 },
  ]
  ws1.getRow(1).eachCell((c) => { c.style = { ...headerStyle } as ExcelJS.Style })

  const registeredCodes = new Set(dbRecords.map((r) => r.accessCode))

  // Predefined codes
  for (const [name, code] of Object.entries(PREDEFINED)) {
    const dbRec = dbRecords.find((r) => r.accessCode === code)
    ws1.addRow({
      type: "预置",
      name,
      code,
      status: dbRec ? "已激活" : "未激活",
      registeredAt: dbRec ? dbRec.createdAt.toLocaleString("zh-CN") : "",
      lastUsed: dbRec?.lastUsedAt ? dbRec.lastUsedAt.toLocaleString("zh-CN") : "",
    })
  }

  // Dynamically registered codes (not in predefined list)
  for (const rec of dbRecords) {
    if (registeredCodes.has(rec.accessCode) && PREDEFINED[rec.teacherName] === rec.accessCode) continue
    // Check if this is a predefined code already listed
    const isPredefined = Object.values(PREDEFINED).includes(rec.accessCode)
    if (isPredefined) continue // already listed above
    ws1.addRow({
      type: "动态注册",
      name: rec.teacherName,
      code: rec.accessCode,
      status: rec.isActive ? "激活" : "停用",
      registeredAt: rec.createdAt.toLocaleString("zh-CN"),
      lastUsed: rec.lastUsedAt ? rec.lastUsedAt.toLocaleString("zh-CN") : "从未使用",
    })
  }

  // ---- Sheet 2: DB records only ----
  const ws2 = wb.addWorksheet("数据库记录")
  ws2.columns = [
    { header: "ID", key: "id", width: 38 },
    { header: "访问码", key: "code", width: 20 },
    { header: "教师姓名", key: "name", width: 16 },
    { header: "激活", key: "active", width: 8 },
    { header: "注册时间", key: "createdAt", width: 22 },
    { header: "最后使用", key: "lastUsed", width: 22 },
  ]
  ws2.getRow(1).eachCell((c) => { c.style = { ...headerStyle } as ExcelJS.Style })

  for (const rec of dbRecords) {
    ws2.addRow({
      id: rec.id,
      code: rec.accessCode,
      name: rec.teacherName,
      active: rec.isActive ? "是" : "否",
      createdAt: rec.createdAt.toLocaleString("zh-CN"),
      lastUsed: rec.lastUsedAt ? rec.lastUsedAt.toLocaleString("zh-CN") : "",
    })
  }

  const outputPath = path.join(process.cwd(), "exports", "访问码汇总.xlsx")
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  await wb.xlsx.writeFile(outputPath)
  console.log(`Exported ${Object.keys(PREDEFINED).length} predefined + ${dbRecords.length} DB records`)
  console.log(`File: ${outputPath}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
