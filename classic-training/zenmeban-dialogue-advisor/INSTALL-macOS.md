# macOS 安装与使用

## 安装

### 方法一：Finder 手动安装

1. 双击 ZIP 解压，得到 `zenmeban-dialogue-advisor` 文件夹。
2. 在 Finder 选择“前往 → 前往文件夹…”，输入 `~/.codex/skills`。
3. 把整个 `zenmeban-dialogue-advisor` 文件夹复制进去。最终应存在：`~/.codex/skills/zenmeban-dialogue-advisor/SKILL.md`。
4. 完全退出并重新打开 Codex，或至少新建一个任务，让技能目录重新扫描。

如果 `.codex/skills` 不存在，可以先创建对应文件夹。不要只复制 `SKILL.md`，其余知识库和脚本也需要一起保留。

### 方法二：双击安装脚本

双击包内 `install-macos.command`。脚本只会复制到 Codex 技能目录；如果同名技能已经存在，它会停止，不会覆盖。macOS 若阻止首次运行，可右键脚本选择“打开”，或改用 Finder 手动安装。

## 验证安装

在终端进入解压后的技能文件夹，运行：

```bash
python3 scripts/validate_package.py
```

看到 `package-validation: PASS` 表示文件、数据量、六步含糊分析合同和隐私扫描均通过。

## 在 Codex 中使用

新建任务后可以直接说：

```text
请用“怎么办？”知识库复盘下面这段录音转写。先分析现场和含糊点，再给 A/B/C 三个朋友版本。

用户：……
对方：……
```

也可以说“分析这段录音”“这句话是什么意思”“我该怎么回复”。如果关键句转写不清，请先修正文字和说话人；技能会保留暂定解释，但不会把低置信度词当成确定事实。

## 更名

A/B/C 是稳定机器 ID。只修改 `references/core/voice-profiles.json` 中三个 `display_name`，不要改 `voice_id`、Schema 键或路由 ID。

## 卸载

退出 Codex 后，把 `~/.codex/skills/zenmeban-dialogue-advisor` 文件夹移到废纸篓，再重新打开 Codex。本操作不会影响其他技能。

## 说明

本包不包含模型 API 密钥、真实录音或用户私人逐字稿。Codex 的具体界面和技能发现方式可能随版本变化；上述目录方式依据本地 Codex 技能结构制作，并已在本包中做离线校验。
