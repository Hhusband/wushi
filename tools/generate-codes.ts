/**
 * 批量生成教师访问码
 *
 * 用法:
 *   npx tsx tools/generate-codes.ts 张三 李四 王五
 *   npx tsx tools/generate-codes.ts --random 20
 *   npx tsx tools/generate-codes.ts --file names.txt
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { v4 as uuid } from "uuid"
import fs from "fs"

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@db:5432/classroom_ai"
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
} as any)

interface Result {
  name: string
  code: string
  exists: boolean
}

function gen(): string {
  return `T${uuid().slice(0, 7).toUpperCase()}`
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
批量生成教师访问码

用法:
  npx tsx tools/generate-codes.ts 张三 李四 王五
  npx tsx tools/generate-codes.ts --random 20
  npx tsx tools/generate-codes.ts --file names.txt

选项:
  --file <path>    从文件读取姓名，每行一个
  --random <n>     随机生成 n 个教师（姓名: 教师01, 教师02...）
  --help, -h       帮助
`)
    await prisma.$disconnect()
    return
  }

  let names: string[]

  if (args[0] === "--file" && args[1]) {
    names = fs.readFileSync(args[1], "utf-8").split("\n").map((l) => l.trim()).filter(Boolean)
  } else if (args[0] === "--random" && parseInt(args[1])) {
    const n = parseInt(args[1])
    names = Array.from({ length: n }, (_, i) => `教师${String(i + 1).padStart(2, "0")}`)
  } else {
    names = args.filter((a) => !a.startsWith("--"))
  }

  if (names.length === 0) {
    console.log("未指定教师姓名。用法: npx tsx tools/generate-codes.ts 姓名1 姓名2 ...")
    await prisma.$disconnect()
    return
  }

  console.log(`生成 ${names.length} 个访问码...\n`)

  const existing = await prisma.teacherAccess.findMany()
  const codesInUse = new Set(existing.map((t) => t.accessCode))
  const nameMap = new Map(existing.map((t) => [t.teacherName, t.accessCode]))

  const results: Result[] = []

  for (const name of names) {
    if (nameMap.has(name)) {
      results.push({ name, code: nameMap.get(name)!, exists: true })
      continue
    }

    let code = gen()
    while (codesInUse.has(code)) code = gen()
    codesInUse.add(code)

    await prisma.teacherAccess.create({
      data: { teacherName: name, accessCode: code },
    })

    results.push({ name, code, exists: false })
  }

  // Print table
  console.log("| 序号 | 姓名 | 访问码 | 状态 |")
  console.log("|------|------|--------|------|")
  const newCodes: string[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    console.log(`| ${String(i + 1).padStart(3)} | ${r.name.padEnd(6)} | \`${r.code}\` | ${r.exists ? "已存在" : "新建"} |`)
    if (!r.exists) newCodes.push(`${r.name},${r.code}`)
  }

  console.log(`\n共 ${results.length} 位教师（新建 ${results.filter((r) => !r.exists).length}）`)

  // Export CSV
  try {
    const csv = "姓名,访问码\n" + results.map((r) => `${r.name},${r.code}`).join("\n")
    const outPath = "/tmp/access-codes.csv"
    fs.writeFileSync(outPath, csv)
    console.log("已导出 →", outPath)
  } catch {
    // ignore permission errors
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("错误:", e.message)
  process.exit(1)
})
