from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

from .config import PROJECT_DIR


SOURCE_PATHS = (
    PROJECT_DIR.parent / "女性职场PUA话术.md",
    PROJECT_DIR.parent / "家庭PUA话术.md",
    PROJECT_DIR.parent / "职场PUA话术集合.md",
)

DIFFICULTY_LABELS = {1: "容易", 2: "中等", 3: "困难"}


@dataclass(frozen=True)
class PUAUtterance:
    entry_id: str
    source_file: str
    source_heading: str
    text: str
    domain: str
    scenario_types: tuple[str, ...]
    tactic_tags: tuple[str, ...]
    severity: int
    difficulty_label: str
    target_group: str

    def model_dump(self) -> dict:
        return asdict(self)


def load_pua_corpus(paths: tuple[Path, ...] = SOURCE_PATHS) -> list[PUAUtterance]:
    entries: list[PUAUtterance] = []
    sequence = 0
    for path in paths:
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except FileNotFoundError:
            continue
        heading = path.stem
        for raw_line in lines:
            line = raw_line.strip()
            if line.startswith("## "):
                heading = line.removeprefix("## ").strip()
                continue
            text = line.removeprefix("- ").strip()
            if len(text) < 6:
                continue
            sequence += 1
            domain = "family" if "家庭" in path.name else "workplace"
            scenario_types = _scenario_types(path.name, heading, text)
            tactic_tags = list(dict.fromkeys([*_context_tags(path.name, heading), *_tactic_tags(text)]))
            severity = _severity(text, tactic_tags)
            entries.append(PUAUtterance(
                entry_id=f"pua-{sequence:03d}",
                source_file=path.name,
                source_heading=heading,
                text=text,
                domain=domain,
                scenario_types=tuple(scenario_types),
                tactic_tags=tuple(tactic_tags),
                severity=severity,
                difficulty_label=DIFFICULTY_LABELS[severity],
                target_group="women" if path.name == "女性职场PUA话术.md" or domain == "family" else "general",
            ))
    return entries


def _scenario_types(source_file: str, heading: str, text: str) -> list[str]:
    scenarios: list[str] = []
    if source_file == "女性职场PUA话术.md":
        scenarios.append("workplace_gender_discrimination")
        if any(word in text for word in ("简历", "应聘", "岗位", "招女生", "男朋友")):
            scenarios.append("workplace_interview")
        if any(word in text for word in ("升职", "培养", "管理层")):
            scenarios.append("workplace_promotion")
        if any(word in text for word in ("终止劳动合同", "开除", "用人偏好")):
            scenarios.append("workplace_job_threat")
    elif source_file == "家庭PUA话术.md":
        mapping = {
            "催婚": "family_marriage_pressure",
            "亲戚聚会": "family_privacy_prying",
            "重男轻女": "family_son_preference",
            "负面情绪": "family_emotion_dumping",
        }
        scenarios.append(next((value for key, value in mapping.items() if key in heading), "family_emotion_dumping"))
    else:
        mapping = {
            "道德/态度/情感绑架": "workplace_emotional_manipulation",
            "薪资/加班/涨薪": "workplace_overtime_coercion",
            "关于项目/升职": "workplace_accountability",
            "关于周末": "workplace_overtime_coercion",
            "领导日常言语PUSH": "workplace_ability_threat",
        }
        scenarios.append(next((value for key, value in mapping.items() if key in heading), "workplace_ability_threat"))
        if any(word in text for word in ("工资", "涨工资", "薪", "成本", "房租水电")):
            scenarios.append("workplace_compensation_pressure")
        if any(word in text for word in ("加班", "晚上", "周末", "休息天", "领导还没走")):
            scenarios.append("workplace_overtime_coercion")
        if any(word in text for word in ("项目", "时间安排", "推动")):
            scenarios.append("workplace_accountability")
        if any(word in text for word in ("开除", "走人", "找不到工作", "AI取代")):
            scenarios.append("workplace_job_threat")
    return list(dict.fromkeys(scenarios))


def _tactic_tags(text: str) -> list[str]:
    rules = {
        "gender_discrimination": ("女生", "女性", "女人", "女孩子", "怀孕", "产假", "月经", "婆家", "嫁出去"),
        "privacy_intrusion": ("男朋友", "结婚", "要孩子", "谈对象", "什么工作", "家里是", "工资", "贷款"),
        "marriage_pressure": ("结婚", "找个对象", "催婚", "年龄再大", "过了三十"),
        "son_preference": ("哥哥", "弟弟", "男孩", "女儿", "儿子", "嫁出去", "重男轻女"),
        "emotional_blackmail": ("为了你好", "感恩", "苦心", "为了谁", "对得起", "闭上眼", "我的任务", "只有你"),
        "fear_appeal": ("孤零零", "养老院", "欺负", "找不到工作", "AI取代", "公司倒闭"),
        "overtime_coercion": ("加班", "晚上", "周末", "休息天", "领导还没走", "电话为什么总是打不通"),
        "compensation_suppression": ("工资", "涨工资", "按时发工资", "无偿", "房租水电", "成本"),
        "ability_belittling": ("干不好", "你不行", "废物", "猪脑子", "不如", "看不到你的任何成长", "不具备"),
        "comparison_pressure": ("别人家的", "别人都能", "高学历", "大学生", "优秀的女同事"),
        "job_threat": ("开除", "终止劳动合同", "随时可以走", "回家", "不招女生"),
        "implicit_threat": ("除非", "不然", "你信不信", "随时", "倾向于培养男员工"),
        "responsibility_shifting": ("时间安排不合理", "自己的安排", "为什么不多找找自己的原因", "公司经营成本"),
        "boundary_violation": ("不要分的那么细", "举手之劳", "当做自己的事", "休息天", "周末"),
        "credit_deprivation": ("不是你有能力", "我给你的这个机会", "领导都看在眼里"),
        "personal_humiliation": ("废物", "猪脑子", "叉烧", "心思不正", "难成大事", "没用的人"),
        "violence_normalization": ("打几下", "骂几句", "被打着骂着"),
        "guilt_transfer": ("因为你", "为了你", "只有你", "不要我们", "不懂事"),
    }
    tags = [tag for tag, phrases in rules.items() if any(phrase in text for phrase in phrases)]
    return tags or ["general_pressure"]


def _context_tags(source_file: str, heading: str) -> list[str]:
    if source_file == "女性职场PUA话术.md":
        return ["gender_discrimination"]
    mapping = {
        "催婚": ["marriage_pressure"],
        "亲戚聚会": ["privacy_intrusion"],
        "重男轻女": ["son_preference", "gender_discrimination"],
        "负面情绪": ["guilt_transfer"],
        "道德/态度/情感绑架": ["emotional_blackmail"],
        "薪资/加班/涨薪": ["compensation_suppression"],
        "关于项目/升职": ["responsibility_shifting"],
        "关于周末": ["overtime_coercion", "boundary_violation"],
        "领导日常言语PUSH": ["ability_belittling"],
    }
    return next((tags for key, tags in mapping.items() if key in heading), [])


def _severity(text: str, tactic_tags: list[str]) -> int:
    hard_markers = (
        "废物", "猪脑子", "叉烧", "一分钱都不用赔", "终止劳动合同", "女人终究是难成大事",
        "不招女生", "骗产假", "打几下骂几句", "随时可以走人", "你信不信我现在把你开掉",
    )
    easy_markers = (
        "有男朋友", "谈对象", "一个月工资", "买房子了没", "未来有什么打算", "眼光别太高",
        "年轻人眼光要放长远", "举手之劳", "学会主动", "你觉得你的态度",
    )
    if any(marker in text for marker in hard_markers) or "personal_humiliation" in tactic_tags:
        return 3
    if any(marker in text for marker in easy_markers) and not {
        "job_threat", "implicit_threat", "violence_normalization"
    }.intersection(tactic_tags):
        return 1
    return 2
