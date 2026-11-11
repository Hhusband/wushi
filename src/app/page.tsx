import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="text-center space-y-8 max-w-lg px-4">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight text-indigo-600">
            吾师
          </h1>
          <p className="text-xl text-muted-foreground">
            AI 课堂讨论助教平台
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            帮助教师实时掌握课堂讨论情况，
            引导学生进行深度思考和合作学习。
          </p>
        </div>

        <div className="flex gap-4 justify-center pt-8">
          <Link
            href="/teacher"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-8 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            我是教师
          </Link>
          <Link
            href="/student"
            className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-white px-8 py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-100"
          >
            我是学生
          </Link>
        </div>
      </div>
    </div>
  )
}
