from __future__ import annotations

from copy import deepcopy


GOALS = [
    {
        "goal_id": "identify_pressure",
        "name": "识别压力手法",
        "description": "不被对方的评价带走，指出当前真正需要讨论的事实或要求。",
        "success_evidence": "能把情绪化评价与具体事项分开。",
    },
    {
        "goal_id": "separate_fact_from_judgment",
        "name": "事实与评价分离",
        "description": "要求对方提供具体事实、标准、责任或依据。",
        "success_evidence": "回应中出现可核对的问题或澄清。",
    },
    {
        "goal_id": "state_position",
        "name": "清楚表达立场",
        "description": "用简短直接的语言说明自己接受什么、不接受什么。",
        "success_evidence": "没有长篇自证，并给出明确立场。",
    },
    {
        "goal_id": "set_boundary",
        "name": "设置边界",
        "description": "对越界询问、无偿要求或贬低表达提出具体边界。",
        "success_evidence": "边界包含对象、条件或停止点。",
    },
    {
        "goal_id": "choose_next_action",
        "name": "推动下一步",
        "description": "将对话转向书面确认、明确决策、暂停沟通或寻求支持。",
        "success_evidence": "提出一个现实可执行的后续动作。",
    },
]


MODULES = [
    {
        "module_id": "pua-workplace-general",
        "title": "通用职场 PUA · 综合施压",
        "domain": "workplace",
        "target_group": "general",
        "scenario_types": [
            "workplace_emotional_manipulation",
            "workplace_overtime_coercion",
            "workplace_compensation_pressure",
            "workplace_accountability",
            "workplace_ability_threat",
            "workplace_job_threat",
        ],
        "setting": "会议室里的一对一工作谈话",
        "counterpart": "综合使用态度、加班、薪资和能力话术的领导",
        "summary": "来自《职场PUA话术集合》的通用职场压力场景，覆盖感恩绑架、无偿加班、薪资回避、责任转移、能力贬低与离职威胁。",
    },
    {
        "module_id": "pua-workplace-interview",
        "title": "女性职场 PUA · 面试越界询问",
        "domain": "workplace",
        "scenario_types": ["workplace_interview"],
        "setting": "招聘面试",
        "counterpart": "带有性别偏见的面试官",
        "summary": "面试官把婚育、性别和岗位能力混在一起追问，练习识别越界问题并把讨论拉回岗位要求。",
    },
    {
        "module_id": "pua-workplace-accountability",
        "title": "女性职场 PUA · 模糊追责",
        "domain": "workplace",
        "scenario_types": ["workplace_accountability", "workplace_ability_threat"],
        "setting": "项目复盘或临时追责谈话",
        "counterpart": "将系统问题归咎于个人态度的领导",
        "summary": "对方使用态度质疑、能力贬低和责任转移施压，练习要求事实、标准和责任边界。",
    },
    {
        "module_id": "pua-workplace-overtime",
        "title": "女性职场 PUA · 加班与周末绑架",
        "domain": "workplace",
        "scenario_types": ["workplace_overtime_coercion"],
        "setting": "下班前或休息日工作沟通",
        "counterpart": "把无边界加班包装成态度和成长的领导",
        "summary": "对方用团队、成长或领导没走等理由要求额外劳动，练习确认优先级、补偿和可用时间。",
    },
    {
        "module_id": "pua-workplace-compensation",
        "title": "女性职场 PUA · 薪资与成长绑架",
        "domain": "workplace",
        "scenario_types": ["workplace_compensation_pressure", "workplace_emotional_manipulation"],
        "setting": "薪资、职责或晋升沟通",
        "counterpart": "用感恩和成长回避具体回报的领导",
        "summary": "对方用机会、成长和经营成本替代薪资与职责承诺，练习把口头承诺转成具体条件。",
    },
    {
        "module_id": "pua-workplace-gender",
        "title": "女性职场 PUA · 性别歧视与晋升偏见",
        "domain": "workplace",
        "scenario_types": ["workplace_gender_discrimination", "workplace_promotion", "workplace_job_threat"],
        "setting": "绩效、晋升或劳动关系谈话",
        "counterpart": "公开使用性别与婚育偏见的管理者",
        "summary": "对方直接以性别、婚育或家庭责任否定能力与机会，练习要求依据、表明异议并保留后续行动。",
    },
    {
        "module_id": "pua-workplace-emotional-pressure",
        "title": "女性职场 PUA · 感恩与态度绑架",
        "domain": "workplace",
        "scenario_types": ["workplace_emotional_manipulation", "workplace_ability_threat", "workplace_job_threat"],
        "setting": "一对一绩效或日常管理谈话",
        "counterpart": "用失望、感恩和替代威胁推动服从的领导",
        "summary": "对方把具体工作问题升级为忠诚、态度或生存压力，练习拒绝自证并要求明确事项。",
    },
    {
        "module_id": "pua-family-marriage",
        "title": "家庭 PUA · 催婚催生",
        "domain": "family",
        "scenario_types": ["family_marriage_pressure"],
        "setting": "家庭谈话或节日聚会",
        "counterpart": "用年龄、养老和孝顺施压的长辈",
        "summary": "长辈把婚育选择与孝顺、孤独或家庭任务绑定，练习承接关心但不交出个人决定权。",
    },
    {
        "module_id": "pua-family-prying",
        "title": "家庭 PUA · 亲戚隐私打听",
        "domain": "family",
        "scenario_types": ["family_privacy_prying"],
        "setting": "亲戚聚会或家庭群聊",
        "counterpart": "连续打听收入、住房和婚恋的亲戚",
        "summary": "亲戚以关心为名追问隐私，练习用轻度、中度或明确边界自然收口。",
    },
    {
        "module_id": "pua-family-son-preference",
        "title": "家庭 PUA · 重男轻女",
        "domain": "family",
        "scenario_types": ["family_son_preference"],
        "setting": "家庭资源或责任分配谈话",
        "counterpart": "用传统性别角色分配资源和义务的家人",
        "summary": "家人以性别决定财产、照料和发展机会，练习指出不对等条件并提出具体边界。",
    },
    {
        "module_id": "pua-family-emotion-dumping",
        "title": "家庭 PUA · 负面情绪转移",
        "domain": "family",
        "scenario_types": ["family_emotion_dumping"],
        "setting": "家庭冲突后的单独谈话",
        "counterpart": "把婚姻、经济或个人挫折转嫁给孩子的家人",
        "summary": "对方使用牺牲叙事、贬低或内疚转移压力，练习停止承担不属于自己的情绪责任。",
    },
]


def list_pua_scenarios() -> list[dict]:
    return [_build_scenario(module) for module in MODULES]


def get_pua_scenario(scenario_id: str) -> dict | None:
    module = next((item for item in MODULES if item["module_id"] == scenario_id), None)
    return _build_scenario(module) if module else None


def get_pua_role(role_id: str) -> dict | None:
    module_id = role_id.removeprefix("role-")
    module = next((item for item in MODULES if item["module_id"] == module_id), None)
    return _build_role(module) if module else None


def get_pua_module(module_id: str) -> dict | None:
    module = next((item for item in MODULES if item["module_id"] == module_id), None)
    return deepcopy(module) if module else None


def _build_scenario(module: dict) -> dict:
    goal_ids = [goal["goal_id"] for goal in GOALS]
    role_id = f"role-{module['module_id']}"
    return {
        "schema_version": "0.2",
        "scenario_id": module["module_id"],
        "version": "0.2",
        "title": module["title"],
        "short_description": module["summary"],
        "module": "pua_response_training",
        "training_mode": "pua_response",
        "pua_module_id": module["module_id"],
        "pua_domain": module["domain"],
        "pua_scenario_types": module["scenario_types"],
        "role_id": role_id,
        "user_role": "正在应对压力话术的当事人",
        "briefing": {
            "setting": module["setting"],
            "user_identity": "你是这次谈话中需要保护事实、选择和边界的一方",
            "counterpart": module["counterpart"],
            "situation_summary": module["summary"],
            "facts": [
                {"label": "容易", "value": "隐含压力或越界试探，一次只出现一种手法。"},
                {"label": "中等", "value": "对方会坚持、改写压力理由，并挑战一次边界。"},
                {"label": "困难", "value": "允许出现语料中明确的贬低、歧视或隐性威胁，但不得超出本模块。"},
            ],
            "user_mission": "识别压力手法，区分事实与评价，表达立场和边界，并推动一个现实的下一步。",
            "preparation_tip": "不用证明自己不是对方说的那种人；先确认具体事项，再决定回应、拒绝、留痕或结束谈话。",
        },
        "learning_goal_ids": goal_ids,
        "learning_goal_details": deepcopy(GOALS),
        "response_framework": ["identify", "clarify", "position", "boundary", "next_action"],
        "situation": {
            "occasion": module["setting"],
            "known_facts": [module["summary"], "训练中的压力话术只能来自本模块检索到的受控语料。"],
            "user_goal": "保持判断和选择权，不被迫接受对方的评价、条件或责任转移。",
            "role_goal": "通过本模块允许的压力手法推动用户服从或自证。",
        },
        "opening_guidance": {
            "intent": "使用符合当前模块与难度的一条压力话术直接进入场景。",
            "must_reference": "只引用 controlled_pressure_examples 中与本模块一致的压力手法。",
            "must_ask": "只推进一个压力点，不要一次堆叠多种攻击。",
            "must_not_do": "不得引入其他场景、其他受保护群体或语料中不存在的现实威胁。",
        },
        "difficulty_options": [1, 2, 3],
        "difficulty_labels": {"1": "容易", "2": "中等", "3": "困难"},
        "default_difficulty": 1,
        "max_turns": 5,
        "initial_state": {
            "phase": "pressure_opening",
            "pressure_level": 1,
            "resolved_goal_ids": [],
            "unresolved_goal_ids": goal_ids,
            "end_reason": None,
        },
        "completion_policy": {
            "complete_when_all_goals_resolved": True,
            "complete_at_max_turns": True,
            "allow_user_exit": True,
        },
    }


def _build_role(module: dict) -> dict:
    goal_ids = [goal["goal_id"] for goal in GOALS]
    move_ids = [
        "repeat_social_norm", "question_attitude", "dismiss_boundary",
        "increase_personal_cost", "demand_compliance",
    ]
    return {
        "schema_version": "0.2",
        "role_id": f"role-{module['module_id']}",
        "display_name": module["counterpart"],
        "applies_to_scenarios": [module["module_id"]],
        "relationship": {
            "type": module["domain"],
            "power_relation": "contextual_pressure",
        },
        "objectives": {
            "public_goal": "让用户接受角色提出的要求、评价或安排。",
            "hidden_concerns": ["用户一旦要求事实和边界，角色的施压空间会缩小。"],
        },
        "voice": {
            "register": "来自原始材料的自然现代中文",
            "speech_rules": [
                "只使用当前模块 controlled_pressure_examples 所体现的压力类型。",
                "容易难度偏试探，中等会坚持一次，困难可使用明确贬低、歧视或隐性威胁。",
                "每轮只推进一种压力手法，不把多个原句拼成辱骂清单。",
                "用户明确设置边界后，可以挑战一次；若用户再次明确，应转向决定或收口。",
                "不得跳出角色教学，不得替用户回答。",
            ],
        },
        "behavior_policy": {
            "opening_move": {"move_id": "pua_opening", "message_intent": "用本模块受控压力话术开启对话"},
            "pressure_moves": [
                {"move_id": "repeat_social_norm", "goal": "用常规、传统、团队或行业惯例继续施压", "fallback_line": "大家都是按这个方式配合的，我希望你也认真考虑一下。"},
                {"move_id": "question_attitude", "goal": "把用户的异议解释为态度、忠诚或能力问题", "fallback_line": "我现在担心的不只是这件事，而是你对这件事的态度。"},
                {"move_id": "dismiss_boundary", "goal": "弱化用户边界并要求其继续自证", "fallback_line": "你一直在回避我的顾虑，但我还没有听到一个让我放心的答复。"},
                {"move_id": "increase_personal_cost", "goal": "提示拒绝可能带来的关系、机会或评价成本", "fallback_line": "你当然可以坚持自己的选择，但这会影响我对后续安排的判断。"},
                {"move_id": "demand_compliance", "goal": "要求用户给出明确服从或拒绝", "fallback_line": "我的要求已经说清楚了，你只需要告诉我接受还是不接受。"},
            ],
            "closing_moves": [
                {"move_id": "close_after_boundary", "message_intent": "承认用户边界并停止当前追问", "fallback_line": "好，你的立场我听到了。这个问题今天先到这里。"},
                {"move_id": "close_after_compliance", "message_intent": "确认用户已经接受安排并结束谈话", "fallback_line": "好，那就按刚才确认的安排执行，今天先谈到这里。"},
                {"move_id": "close_with_disagreement", "message_intent": "保留不同意见并结束谈话", "fallback_line": "行，你的意思我知道了。我们保留各自意见，今天先到这里。"},
                {"move_id": "close_with_consequence", "message_intent": "说明模块内合理后续并结束谈话", "fallback_line": "你的态度我知道了，后续我会按现有流程处理。今天就谈到这里。"},
            ],
            "concession_rules": [
                {"condition_id": "specifics_requested", "when": "用户持续要求具体事实或标准", "reaction": "停止空泛评价，给出角色能够提供的具体条件。"},
                {"condition_id": "boundary_repeated", "when": "用户连续两次清楚表达边界", "reaction": "不再升级同一攻击，转向决定或结束。"},
            ],
            "controlled_adversarial_language": {
                "enabled": True,
                "allowed_scenario_types": module["scenario_types"],
                "difficulty_ceiling_from_session": True,
                "may_use_personal_humiliation_at_difficulty_3": True,
                "may_use_gender_discrimination_in_gender_modules": True,
                "may_use_implicit_threat_at_difficulty_3": True,
            },
            "forbidden_behaviors": [
                {"rule_id": "no_off_module_attack", "description": "不得使用当前模块和检索语料之外的攻击类型。"},
                {"rule_id": "no_invented_physical_threat", "description": "不得自行创造人身伤害、跟踪、报复或性暴力威胁。"},
                {"rule_id": "no_fact_invention", "description": "不得编造用户现实经历、违法行为、健康状况或家庭信息。"},
                {"rule_id": "no_coaching_in_character", "description": "不得跳出角色教学或评价用户。"},
            ],
        },
        "learning_goal_alignment": {
            goal_id: [move_ids[index]] for index, goal_id in enumerate(goal_ids)
        },
    }
