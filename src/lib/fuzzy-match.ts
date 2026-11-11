const CN_NUMBERS: Record<string, string> = {
  "一": "1", "二": "2", "三": "3", "四": "4", "五": "5",
  "六": "6", "七": "7", "八": "8", "九": "9", "十": "10",
}

function normalizeChineseNumbers(s: string): string {
  return s.replace(/[一二三四五六七八九十]/g, (m) => CN_NUMBERS[m] || m)
}

function normalizeGrade(s: string): string {
  let out = normalizeChineseNumbers(s)
  out = out.replace(/年级/g, "").replace(/年/g, "").trim()
  return out
}

function normalizeClass(s: string): string {
  let out = normalizeChineseNumbers(s)
  out = out.replace(/班/g, "").trim()
  if (/^\d+$/.test(out)) out = out.padStart(2, "0")
  return out
}

function normalizeLessonNumber(s: string): string {
  let out = normalizeChineseNumbers(s)
  out = out.replace(/第/g, "").replace(/课/g, "").trim()
  return out
}

function normalizeLessonName(s: string): string {
  return s.replace(/号/g, "").replace(/《/g, "").replace(/》/g, "").trim()
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function fuzzyMatch(input: string, target: string): boolean {
  const ni = input.toLowerCase().trim()
  const nt = target.toLowerCase().trim()
  if (ni === nt) return true
  if (nt.includes(ni) || ni.includes(nt)) return true
  const maxLen = Math.max(ni.length, nt.length)
  const dist = levenshtein(ni, nt)
  return dist <= Math.ceil(maxLen * 0.3)
}

export function matchGrade(input: string): string {
  return normalizeGrade(input)
}

export function matchClass(input: string): string {
  return normalizeClass(input)
}

export function matchLessonNumber(input: string): string {
  return normalizeLessonNumber(input)
}

export function matchLessonName(input: string, candidates: string[]): string | null {
  const ni = normalizeLessonName(input)
  let best: { name: string; dist: number } | null = null
  for (const c of candidates) {
    const nc = normalizeLessonName(c)
    if (nc === ni) return c
    if (nc.includes(ni) || ni.includes(nc)) return c
    const dist = levenshtein(ni, nc)
    if (dist <= Math.ceil(Math.max(ni.length, nc.length) * 0.3)) {
      if (!best || dist < best.dist) best = { name: c, dist }
    }
  }
  return best?.name || null
}
