import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// ---- 班级 / 年级名称规范化（兼容历史数据里的阿拉伯数字写法）----
// 学生端与教师端下拉都使用中文序号（一班…六班 / 一年级…六年级），
// 但早期导入或手工录入的数据可能是「1班」「4年级」。匹配时统一成中文再比较，
// 避免出现「老师启动了四年级一班，学生选四年级一班却提示没有进行中的课堂」。

const CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]

function toCnNumber(n: number): string {
  if (n >= 0 && n < 10) return CN_DIGITS[n]
  if (n === 10) return "十"
  if (n > 10 && n < 20) return "十" + CN_DIGITS[n - 10]
  if (n >= 20 && n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return CN_DIGITS[tens] + "十" + (ones ? CN_DIGITS[ones] : "")
  }
  return String(n)
}

/** 统一班级名：去空格、去「第」前缀，阿拉伯数字转中文（1班 → 一班） */
export function normalizeClassName(raw: string | null | undefined): string {
  const s = String(raw || "").trim().replace(/\s+/g, "")
  const m = /^(?:第)?(\d{1,3})班$/.exec(s)
  if (m) return `${toCnNumber(parseInt(m[1], 10))}班`
  return s
}

/** 统一年级名：阿拉伯数字转中文（4年级 → 四年级） */
export function normalizeGrade(raw: string | null | undefined): string {
  const s = String(raw || "").trim().replace(/\s+/g, "")
  const m = /^(\d{1,2})年级$/.exec(s)
  if (m) return `${toCnNumber(parseInt(m[1], 10))}年级`
  return s
}
