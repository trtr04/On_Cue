export const TRAINING_GOALS = [
  { id: "identify_pressure", name: "识别压力手法", hint: "把对方的评价和真正要处理的事情分开。" },
  { id: "separate_fact_from_judgment", name: "事实与评价分离", hint: "追问具体事实、标准、责任或依据。" },
  { id: "state_position", name: "清楚表达立场", hint: "简短说清楚你接受什么、不接受什么。" },
  { id: "set_boundary", name: "设置边界", hint: "说出条件、停止点，或明确哪些问题不讨论。" },
  { id: "choose_next_action", name: "推动下一步", hint: "提出书面确认、暂停沟通或一个明确时间点。" },
];

export const TRAINING_MODULES = [
  {
    id: "pua-workplace-general",
    domain: "work",
    title: "通用职场 PUA · 综合施压",
    role: "综合使用职场压力话术的领导",
    summary: "覆盖感恩绑架、无偿加班、薪资回避、责任转移、能力贬低和离职威胁。",
    opener: "我对你是有点失望的。公司给了你机会，你现在却总在计较工作量和回报，先说说你的态度是不是有问题？",
  },
  {
    id: "pua-workplace-interview",
    domain: "work",
    title: "面试越界询问",
    role: "带有性别偏见的面试官",
    summary: "把婚育、性别和岗位能力混在一起追问。",
    opener: "这个岗位强度很大。你最近有结婚、生孩子的计划吗？我们得确认你能不能稳定投入。",
  },
  {
    id: "pua-workplace-accountability",
    domain: "work",
    title: "模糊追责",
    role: "将系统问题归咎个人的领导",
    summary: "用态度质疑和责任转移代替具体复盘。",
    opener: "这个结果出来，你首先该反思自己的态度，而不是一直解释客观原因。",
  },
  {
    id: "pua-workplace-overtime",
    domain: "work",
    title: "加班与周末绑架",
    role: "把加班包装成成长的领导",
    summary: "用团队、成长和态度要求无边界加班。",
    opener: "大家都还没走，你现在走是不是不太合适？年轻人应该多为成长付出一点。",
  },
  {
    id: "pua-workplace-compensation",
    domain: "work",
    title: "薪资与成长绑架",
    role: "回避具体回报的领导",
    summary: "用机会和感恩替代薪资、职责承诺。",
    opener: "公司给你的成长机会已经很多了，现在就谈涨薪，会不会太只看眼前？",
  },
  {
    id: "pua-workplace-gender",
    domain: "work",
    title: "性别歧视与晋升偏见",
    role: "使用性别与婚育偏见的管理者",
    summary: "用性别和家庭责任否定能力与机会。",
    opener: "这个管理岗需要长期出差，女员工以后要顾家，我们更倾向安排男同事。",
  },
  {
    id: "pua-workplace-emotional-pressure",
    domain: "work",
    title: "感恩与态度绑架",
    role: "用忠诚与替代威胁施压的领导",
    summary: "把工作问题升级为忠诚、态度和生存压力。",
    opener: "我对你挺失望的。公司培养你这么久，你现在连这点要求都要计较吗？",
  },
  {
    id: "pua-family-marriage",
    domain: "home",
    title: "催婚催生",
    role: "用年龄与孝顺施压的长辈",
    summary: "把婚育选择与孝顺、养老和家庭任务绑定。",
    opener: "你再不结婚我们怎么放心？父母就这一个愿望，你连这点孝心都没有吗？",
  },
  {
    id: "pua-family-prying",
    domain: "home",
    title: "亲戚隐私打听",
    role: "连续打听隐私的亲戚",
    summary: "以关心为名追问收入、住房和婚恋。",
    opener: "一家人有什么不能说的？你现在一个月到底挣多少，房子准备什么时候买？",
  },
  {
    id: "pua-family-son-preference",
    domain: "home",
    title: "重男轻女",
    role: "用性别分配资源和义务的家人",
    summary: "以性别决定财产、照料和发展机会。",
    opener: "家里的房子当然要留给男孩，你是女儿，多承担一点照顾父母也是应该的。",
  },
  {
    id: "pua-family-emotion-dumping",
    domain: "home",
    title: "负面情绪转移",
    role: "把挫折转嫁给孩子的家人",
    summary: "用牺牲叙事、贬低和内疚转移压力。",
    opener: "我这么辛苦都是为了你，你现在还不听我的，真是让我寒心。",
  },
];

const PRESSURE_REPLIES = [
  "大家都是按这个方式配合的，我希望你也认真考虑一下。",
  "我担心的不只是这件事，而是你对这件事的态度。",
  "你一直在回避我的顾虑，我还没有听到让我放心的答复。",
  "你当然可以坚持，但这会影响我对后续安排的判断。",
  "我的要求已经说清楚了，你只需要告诉我接受还是不接受。",
];

const GOAL_PATTERNS = {
  identify_pressure: /评价|态度|压力|绑架|不讨论人|拉回事|就事论事|真正要讨论/,
  separate_fact_from_judgment: /具体|事实|标准|依据|责任|优先级|事项|说清楚|哪一项|什么要求/,
  state_position: /我(?:的立场|会|不同意|接受|不接受|决定|可以)|对我来说|我的选择/,
  set_boundary: /不接受|不方便|不想聊|不讨论|请停止|先到这里|到此为止|我的边界|不能继续|拒绝/,
  choose_next_action: /书面|确认|明天|后续|流程|暂停|记录|交付|再约|时间|发邮件|下一步/,
};

function detectGoals(text) {
  return TRAINING_GOALS.filter((goal) => GOAL_PATTERNS[goal.id].test(text)).map((goal) => goal.id);
}

export function getTrainingModule(moduleId) {
  return TRAINING_MODULES.find((module) => module.id === moduleId) || null;
}

export function createTrainingSession(moduleId) {
  const module = getTrainingModule(moduleId);
  if (!module) throw new Error(`Unknown training module: ${moduleId}`);
  return {
    moduleId,
    turn: 0,
    achievedGoalIds: [],
    boundaryCount: 0,
    finished: false,
    endReason: null,
    reply: module.opener,
  };
}

export function submitTrainingTurn(session, rawText) {
  if (session.finished) return session;
  const text = String(rawText || "").trim();
  if (!text) return session;

  const detected = detectGoals(text);
  const achievedGoalIds = [...new Set([...session.achievedGoalIds, ...detected])];
  const boundaryCount = session.boundaryCount + (detected.includes("set_boundary") ? 1 : 0);
  const turn = session.turn + 1;
  const allGoalsResolved = achievedGoalIds.length === TRAINING_GOALS.length;
  const userExit = /结束训练|退出训练/.test(text);
  const boundaryHeld = boundaryCount >= 2;
  const maxTurns = turn >= 5;
  const finished = allGoalsResolved || userExit || boundaryHeld || maxTurns;
  const endReason = allGoalsResolved
    ? "all_goals_resolved"
    : userExit
      ? "user_exit"
      : boundaryHeld
        ? "boundary_held"
        : maxTurns
          ? "max_turns"
          : null;
  const reply = finished
    ? boundaryHeld
      ? "好，你的边界我听到了。这个问题今天先到这里。"
      : "好，你的意思我知道了。我们保留各自意见，今天先到这里。"
    : PRESSURE_REPLIES[Math.min(turn - 1, PRESSURE_REPLIES.length - 1)];

  return { ...session, turn, achievedGoalIds, boundaryCount, finished, endReason, reply };
}

export function getTrainingHints(session) {
  const unresolved = TRAINING_GOALS.filter((goal) => !session.achievedGoalIds.includes(goal.id));
  return unresolved.slice(0, 3).map((goal) => goal.hint);
}

export function buildTrainingReview(session) {
  const achieved = TRAINING_GOALS.filter((goal) => session.achievedGoalIds.includes(goal.id));
  const unresolved = TRAINING_GOALS.filter((goal) => !session.achievedGoalIds.includes(goal.id));
  return {
    achievedNames: achieved.map((goal) => goal.name),
    totalGoals: TRAINING_GOALS.length,
    nextStep: unresolved[0]?.hint || "五项能力都已覆盖，可以换一个更难的场景继续练习。",
  };
}
