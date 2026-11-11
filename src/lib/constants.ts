export const GRADES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"] as const

export const SUBJECTS = ["语文", "数学", "科学", "道法"] as const

export const SUBJECT_GUIDANCE: Record<string, { label: string; role: string; guidance: string; welcomeHint: string }> = {
  "语文": {
    label: "语文",
    role: "小学语文教学专家",
    guidance: `- 引导学生紧扣课文原文，引用具体段落或语句作为依据
- 关注人物形象、情感变化、写作手法等语文学科核心要素
- 鼓励学生从文本出发，进行合理的联想与感悟`,
    welcomeHint: "请大家结合课文内容，大胆说出自己的想法。",
  },
  "数学": {
    label: "数学",
    role: "小学数学教学专家",
    guidance: `- 引导学生解释解题思路和推理过程，而不只是说出答案
- 鼓励学生尝试不同的解题方法，比较各方法的优劣
- 关注数学概念的准确理解和逻辑推理的严密性`,
    welcomeHint: "请大家说清解题思路，大胆分享自己的方法。",
  },
  "科学": {
    label: "科学",
    role: "小学科学教学专家",
    guidance: `- 引导学生基于观察和实验事实进行推理，区分假设与结论
- 鼓励学生描述现象、提出猜想、分析因果关系
- 关注科学探究方法的培养：观察、比较、分类、归纳`,
    welcomeHint: "请大家基于观察和实验，大胆提出自己的猜想。",
  },
  "道法": {
    label: "道法",
    role: "小学道德与法治教学专家",
    guidance: `- 引导学生结合生活实际，分析案例中的道德与法律问题
- 鼓励学生换位思考，理解不同立场和价值观
- 关注学生价值判断能力和规则意识的培养`,
    welcomeHint: "请大家结合实际案例，大胆表达自己的观点。",
  },
}

export const SESSION_STATUS = {
  ACTIVE: "active",
  SUMMARIZING: "summarizing",
  SUBMITTED: "submitted",
} as const

export const LESSON_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
} as const

export const CLASSROOM_STATUS = {
  ACTIVE: "active",
  ENDED: "ended",
} as const

export const MESSAGE_ROLES = {
  STUDENT: "student",
  ASSISTANT: "assistant",
  SYSTEM: "system",
} as const

export const AGENT_TYPES = {
  STUDENT: "student",
  TEACHER: "teacher",
  REPORT: "report",
} as const

export const END_DISCUSSION_KEYWORDS = [
  "没有了",
  "没有补充",
  "没有",
  "没补充",
  "讨论完了",
  "讨论完",
  "结束讨论",
  "结束吧",
  "提交吧",
  "可以提交了",
  "可以提交",
  "提交",
  "好了",
  "就这样吧",
  "没了",
  "说完了",
  "讲完了",
  "无补充",
  "没其他",
  "没别的",
]

// Teacher name → access code mapping for dedicated teachers
export const TEACHER_ACCESS_MAP: Record<string, string> = {
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

export const ACCESS_CODES = Object.values(TEACHER_ACCESS_MAP)
