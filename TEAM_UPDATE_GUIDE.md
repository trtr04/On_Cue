# On Cue 团队版本更新与无冲突合并指南

- 更新时间：2026-08-30
- 最新团队分支：`team/full-source-no-secrets-2026-08-29`
- 旧团队版本基线：`a258d9e`

## 1. 这次更新了什么

### 1.1 录音与转写

- 录音改为独立的“开始录音、暂停/继续、结束录音”控制，不再依赖重复点击同一个按钮。
- 离开录音模块、切换功能页或页面进入后台时，自动结束录音并释放麦克风，避免录音持续运行。
- 录音、原音频、转写和逐句角色会自动保存；进入其他页面再返回不会消失。
- 语音转文字继续由服务器 API 完成，不加载浏览器本地识别模型。
- 转写结果按句拆成独立对话卡；如果接口没有返回说话人分离结果，也会按标点拆句并标记为“待确认”。

### 1.2 逐句角色确认

- 每个句子都可以选择“待确认、我、对方、导师、领导、家人”等预设角色。
- 每个句子新增明显的自定义说话人输入框，可以填写“客户、姐姐、同学”等称呼。
- 修改显示角色时会同步更新分析请求中的 `speakerId`，避免界面角色与后台角色不一致。

### 1.3 分析前补充当前情况

最终分析前固定经过以下流程：

1. 录音并结束。
2. 核对逐句转写和说话人。
3. 补充当前情况、关系、场合、感受和期望结果。
4. 生成三角色分析。

“补充当前情况”新增独立文本框，用于填写录音中没有说清的前因后果、近期变化和现实限制。所有背景字段均为可选。

### 1.4 三个技能角色分析

- 当前确认对话是唯一事实来源；历史知识卡只提供模式和策略参考。
- 三个技能包分别作为三个独立角色分析当前对话：
  - A：价值交换、投入回报与风险。
  - B：人情场面、高情商表达和可复制话术。
  - C：位置、系统、权限和下一步行动。
- 三个角色必须同时返回，不能把同一答案换词重复三遍。
- 前台标题显示当前对话分析，不再把历史知识库场景当成本次事件。

### 1.5 验证结果

- `npm run test:oncue`：30 项测试通过。
- `npm run build`：生产构建通过。
- 技能包校验：通过，包含 120 个场景、3 个角色和 20 个歧义案例。
- `npm audit --omit=dev`：0 个已知漏洞。

## 2. 主要改动文件

| 文件 | 用途 | 合并时注意 |
|---|---|---|
| `app.js` | 录音状态机、离页停录、逐句角色、当前情况和分析流程 | 核心整合文件，不要用旧文件整体覆盖 |
| `index.html` | 新录音按钮、自定义角色入口和补充当前情况页面 | 保留新版页面结构，再加入队友模块入口 |
| `styles.css` | 录音控制区、自定义输入和当前情况表单样式 | 按选择器合并，不要整文件替换 |
| `transcription.js` | API 转写、按句拆分和说话人数据规范化 | 保留新版 `segments` 数据结构 |
| `app/api/transcribe/route.ts` | 服务器端转写 API | 密钥仍只从环境变量读取 |
| `app/api/analyze/route.ts` | 当前对话、三个技能角色和知识库分析 API | 保留三个角色配置加载和输入校验 |
| `lib/knowledge-grounding.js` | 当前事实与历史知识卡的数据边界 | 不要恢复为“历史场景直接回答” |
| `tests/oncue-integration.test.mjs` | 全流程回归测试 | 合并后必须完整运行 |
| `public/oncue.html`、`public/assets/oncue-*` | 构建生成文件 | 不手工解决冲突，最后重新运行 `npm run build` |

真实 API 密钥不在 GitHub。`.env` 继续只保存在每个人自己的电脑或部署平台环境变量中。

## 3. 队友没有本地修改：直接更新

```bash
git fetch origin
git switch team/full-source-no-secrets-2026-08-29
git pull --ff-only origin team/full-source-no-secrets-2026-08-29
npm ci
npm run test:oncue
npm run dev
```

如果本地还没有 `.env`，复制 `.env.example` 为 `.env`，再由本人填写 API 配置。不要提交 `.env`。

## 4. 队友在旧团队版本上已有自己的提交

先确保自己的修改已经提交到个人分支，不要在有未提交文件时开始整合。

```bash
git status
git switch -c backup/你的名字-before-update
git add 你实际修改的文件
git commit -m "save: 我的模块修改"
git fetch origin
git rebase origin/team/full-source-no-secrets-2026-08-29
```

如果没有冲突，直接运行第 6 节的验证命令。

如果出现冲突：

1. `app.js`、`index.html`、`styles.css` 优先保留新版录音和分析主流程，再把自己的模块入口逐段加入。
2. 不要选择“全部使用旧版本”，否则会重新引入持续录音、跳过当前情况页面或角色无法自定义的问题。
3. 不要手工合并 `public/oncue.html` 和哈希资源文件；先解决源文件，最后运行 `npm run build` 重新生成。
4. 解决一个文件后执行 `git add 文件名`，全部处理完再执行：

```bash
git rebase --continue
```

如果发现合并方向错误，可以安全返回合并前状态：

```bash
git rebase --abort
```

## 5. 队友仍在 `new_classic_mode` 旧分支开发

`new_classic_mode` 与当前整合分支没有共同提交历史，不要执行普通 `git merge new_classic_mode`，也不要使用 `--allow-unrelated-histories` 把两个完整项目强行拼在一起。

正确方式是以最新团队分支为底，再迁移队友自己负责的提交：

```bash
git fetch origin
git switch -c integrate/你的名字 origin/team/full-source-no-secrets-2026-08-29
git cherry-pick 队友自己的提交SHA
```

建议一次只 `cherry-pick` 一个小提交。只迁移队友真实修改的模块，不迁移旧项目的整套页面或构建产物。

如果队友的提交把许多无关文件混在一起，不要直接 cherry-pick。请从最新团队分支新建分支，只把本人负责的模块文件逐个迁入，再手工接入新版 `app.js` 的入口。

### 可以按模块选择迁移的内容

- 经典训练角色、场景或素材：对应的 `classic-training/` 子目录及其资源。
- 情绪暴击游戏：`public/mouse-game.html` 及其专属素材。
- 新的知识卡或角色资料：技能包对应的 JSON/Markdown 资源；不要覆盖三个稳定 ID `A/B/C`。

### 不要从旧分支整体覆盖的文件

- `app.js`
- `index.html`
- `styles.css`
- `transcription.js`
- `app/api/analyze/route.ts`
- `app/api/transcribe/route.ts`
- `lib/knowledge-grounding.js`
- `public/oncue.html`
- `public/assets/oncue-*.js`
- `public/assets/oncue-*.css`
- `.env` 或任何真实密钥文件

## 6. 合并后的统一验收

```bash
npm ci
npm run test:oncue
npm run build
python3 classic-training/zenmeban-dialogue-advisor/scripts/validate_package.py
npm audit --omit=dev
```

然后人工检查下面这条完整流程：

1. 开始录音，分别测试暂停、继续和结束。
2. 录音中切换到其他模块，确认麦克风已经停止。
3. 检查转写是否一句一个对话框。
4. 给不同句子选择预设角色，并输入一个自定义角色。
5. 返回再进入，确认录音、文字和角色没有消失。
6. 填写“补充当前情况”，生成分析。
7. 确认 A/B/C 三个角色都在分析本次对话，而不是复述历史知识卡。

## 7. 推荐团队协作规则

- 每个人从最新团队分支创建自己的短期功能分支，例如 `feature/姓名-模块名`。
- 一次提交只处理一个模块，避免把构建文件、UI、API 和素材混成一个超大提交。
- 合并前先同步最新团队分支并运行完整测试。
- 不在 GitHub 提交 `.env`、API Key、录音文件或真实用户逐字稿。
- 发生冲突时保留新版主流程，通过新增函数或小范围修改接入个人模块，不复制整套旧页面。
