-- CreateTable
CREATE TABLE "teacher_access" (
    "id" TEXT NOT NULL,
    "access_code" VARCHAR(50) NOT NULL,
    "teacher_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "teacher_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "teacher_id" VARCHAR(100) NOT NULL,
    "grade" VARCHAR(20) NOT NULL,
    "class_name" VARCHAR(50) NOT NULL,
    "lesson_number" VARCHAR(20) NOT NULL,
    "lesson_name" VARCHAR(200) NOT NULL,
    "core_question" TEXT NOT NULL,
    "follow_up_questions" JSONB NOT NULL DEFAULT '[]',
    "discussion_requirements" TEXT NOT NULL DEFAULT '',
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_lessons" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "teacher_id" VARCHAR(100) NOT NULL,
    "grade" VARCHAR(20) NOT NULL,
    "class_name" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "current_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_sessions" (
    "id" TEXT NOT NULL,
    "current_lesson_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "grade" VARCHAR(20) NOT NULL,
    "class_name" VARCHAR(50) NOT NULL,
    "group_number" INTEGER NOT NULL,
    "group_name" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "author_name" VARCHAR(100),
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "current_lesson_id" TEXT NOT NULL,
    "group_name" VARCHAR(100) NOT NULL,
    "main_points" JSONB NOT NULL DEFAULT '[]',
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "conclusions" TEXT NOT NULL DEFAULT '',
    "questions" TEXT NOT NULL DEFAULT '',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_reports" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "current_lesson_id" TEXT NOT NULL,
    "overall_summary" TEXT NOT NULL DEFAULT '',
    "top_groups" JSONB NOT NULL DEFAULT '[]',
    "struggling_groups" JSONB NOT NULL DEFAULT '[]',
    "common_misconceptions" JSONB NOT NULL DEFAULT '[]',
    "teaching_suggestions" TEXT NOT NULL DEFAULT '',
    "follow_up_questions" JSONB NOT NULL DEFAULT '[]',
    "board_suggestions" TEXT NOT NULL DEFAULT '',
    "homework_suggestions" TEXT NOT NULL DEFAULT '',
    "keyword_cloud" JSONB NOT NULL DEFAULT '[]',
    "opinion_distribution" JSONB NOT NULL DEFAULT '[]',
    "discussion_depth_scores" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_logs" (
    "id" TEXT NOT NULL,
    "agent_type" VARCHAR(20) NOT NULL,
    "session_id" TEXT,
    "lesson_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "input" TEXT NOT NULL DEFAULT '',
    "output" TEXT NOT NULL DEFAULT '',
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_access_access_code_key" ON "teacher_access"("access_code");

-- CreateIndex
CREATE INDEX "lessons_teacher_id_idx" ON "lessons"("teacher_id");

-- CreateIndex
CREATE INDEX "lessons_grade_class_name_idx" ON "lessons"("grade", "class_name");

-- CreateIndex
CREATE INDEX "current_lessons_grade_class_name_status_idx" ON "current_lessons"("grade", "class_name", "status");

-- CreateIndex
CREATE INDEX "current_lessons_status_idx" ON "current_lessons"("status");

-- CreateIndex
CREATE UNIQUE INDEX "student_sessions_current_lesson_id_group_number_key" ON "student_sessions"("current_lesson_id", "group_number");

-- CreateIndex
CREATE INDEX "messages_session_id_created_at_idx" ON "messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_session_id_key" ON "submissions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_reports_current_lesson_id_key" ON "lesson_reports"("current_lesson_id");

-- CreateIndex
CREATE INDEX "agent_logs_agent_type_created_at_idx" ON "agent_logs"("agent_type", "created_at");

-- CreateIndex
CREATE INDEX "agent_logs_session_id_idx" ON "agent_logs"("session_id");

-- AddForeignKey
ALTER TABLE "current_lessons" ADD CONSTRAINT "current_lessons_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_current_lesson_id_fkey" FOREIGN KEY ("current_lesson_id") REFERENCES "current_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "student_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "student_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_current_lesson_id_fkey" FOREIGN KEY ("current_lesson_id") REFERENCES "current_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_reports" ADD CONSTRAINT "lesson_reports_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_reports" ADD CONSTRAINT "lesson_reports_current_lesson_id_fkey" FOREIGN KEY ("current_lesson_id") REFERENCES "current_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "student_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
