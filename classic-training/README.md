# 错不起我对了 · 表达与情绪训练助手

这是一个普通话沟通训练 MVP：让用户在有压力的真实对话中练习“怎么快速组织信息、清楚表达、推动对方做决策”，而不是只获得一段标准答案。

当前已贯通两条用户路径：

1. **经典训练**：进入“领导质问进度”预设场景，与 LLM 模拟的直属领导完成最多五轮对话，随时可请求提示或结束复盘。
2. **真实经历训练**：用户讲述一段真实经历，AI 逐步补问缺失信息，生成可确认的场景卡、角色卡和学习目标，再进入同一套对练与复盘流程。

包括角色开场在内的每一句实际角色对话都由智谱对话补全 API 生成。未配置 API Key 时，后端会返回明确错误，不会用预设台词伪装成模型对话。

## 已完成

- 一页学习目标规格和五个稳定能力 ID。
- 直属领导角色卡、追问动作、松动条件和禁止行为。
- 场景卡，通过 `scenario_id`、`role_id` 和 `learning_goal_ids` 与前两项连接。
- FastAPI 接口、SQLite 持久化会话和文字聊天前端。
- 强制 LLM 配置：所有实际角色发言均调用模型。
- 最多五轮用户作答，可随时结束并由 LLM 生成五维复盘。
- 每轮可请求一次情境化提示，提示不占轮数，也不会直接给出完整标准答案。
- 真实经历整理：自由描述、AI 单问题补问、场景确认卡和 SQLite 持久化。
- 确认后的真实场景可生成专属学习目标与角色规则，并直接进入五轮训练、提示和复盘。
- 自动 API 文档：`/docs`。
- 浏览器原生录音与腾讯云转写：经典训练单段最多 90 秒；真实经历单段最多 180 秒，可多次追加。
- 腾讯云极速版网关返回 404 时自动降级到标准录音文件识别；180 秒 WAV 会自动分段，避免超过标准接口的单文件限制。

## 当前系统如何串联

```text
浏览器前端
  ├─ 文字输入
  └─ 麦克风录音 → 16 kHz 单声道 WAV
          ↓
FastAPI 后端
  ├─ 腾讯云 ASR：语音转待确认文字
  ├─ 智谱 LLM：补问、角色模拟、提示、复盘
  ├─ 场景卡 + 角色卡 + 学习目标：控制训练内容
  └─ SQLite：保存经历、会话、提示和复盘
```

语音转写只负责把声音变成文字。文字会先回填输入框，由用户确认或修改后才发给 LLM，避免误识别直接影响训练。

## 本地启动

```bash
cd On_Cue/classic-training
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
uvicorn backend.app.main:app --reload
```

必须通过 FastAPI 地址打开，不要在 Finder 中直接双击 `frontend/index.html`。直接打开得到的是 `file://` 页面，无法访问后端接口。

打开：

- 网页：<http://127.0.0.1:8000/>
- API 调试文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/api/health>

运行合同和最小会话测试：

```bash
python3 -m unittest discover -s tests -v
```

## 智谱 API 配置

先在智谱开放平台创建 API Key，然后复制配置文件：

```bash
cp .env.example .env
```

打开 `.env`，只需要填写：

```text
ZHIPU_API_KEY=你的智谱APIKey
```

随后启动：

```bash
uvicorn backend.app.main:app --reload
```

`ZHIPU_API_URL` 已默认指向智谱通用对话补全接口；`ZHIPU_MODEL` 默认使用当前实测可用的 `glm-4-flash-250414`。若它返回 429，后端会立即尝试 `ZHIPU_FALLBACK_MODELS` 中的 `glm-4.7-flash`。两者都可以在 `.env` 中修改。

不要把 API Key 写入前端、场景卡或提交到 Git。

如果没有 `ZHIPU_API_KEY`，创建训练会返回 `503`，网页会提示模型尚未配置。

## 腾讯云语音识别配置

网页使用浏览器原生麦克风 API 录音，并在本地转换成腾讯云稳定支持的 16 kHz、16-bit、单声道 WAV。录音上传到 FastAPI 后端，后端优先调用“录音文件识别极速版”；如果腾讯旧网关返回 404，则自动改用标准录音文件识别。腾讯云密钥不会发送给浏览器。

在 `.env` 中填写：

```text
TENCENT_APP_ID=你的腾讯云AppID
TENCENT_SECRET_ID=你的腾讯云SecretID
TENCENT_SECRET_KEY=你的腾讯云SecretKey
```

需要先在腾讯云控制台开通语音识别并领取对应额度。如果 SecretId 属于 CAM 子账号，需关联 `QcloudASRFullAccess`，或至少允许 `asr:CreateRecTask` 和 `asr:DescribeTaskStatus`（`resource` 必须为 `*`）。

录音文字只会填入当前输入框，不会自动提交给 LLM；用户可以检查、修改，再发送。真实经历每次转写会另起一行追加，因此可以分几段讲述。当前实现不长期保存原始音频。

## 本地数据

首次启动后端时会自动创建：

```text
data/classic_training.db
```

它保存训练会话、逐轮消息、即时提示和复盘结果。数据库文件已加入 `.gitignore`，不会被误提交。服务器重启后，已有会话仍可通过原来的 `session_id` 读取。

如果希望把数据库放到其他位置，可以在 `.env` 中设置绝对路径：

```text
DATABASE_PATH=/你的路径/classic_training.db
```

当前采用非流式输出和 JSON 格式，方便后端一次性校验角色回复与隐藏状态。后续如果希望文字逐字出现，可以增加独立的流式对话接口，但不应把隐藏状态直接流给前端。

## 当前 API 合同

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/health` | 检查后端是否运行 |
| `GET` | `/api/scenarios` | 获取兼容的场景摘要 |
| `POST` | `/api/incidents` | 提交一段真实经历并取得第一条补问或确认卡 |
| `GET` | `/api/incidents/{incident_id}` | 读取已保存的真实经历整理进度 |
| `POST` | `/api/incidents/{incident_id}/answers` | 回答一条补问并更新场景草稿 |
| `POST` | `/api/incidents/{incident_id}/confirm` | 确认并保存已经完整的场景卡 |
| `POST` | `/api/incidents/{incident_id}/training` | 生成或复用专属角色卡并开始五轮训练 |
| `POST` | `/api/transcriptions` | 上传浏览器 WAV；按 `purpose` 应用 90/180 秒限制并返回待确认文字 |
| `POST` | `/api/training/sessions` | 创建训练并取得角色开场 |
| `GET` | `/api/training/sessions/{session_id}` | 获取完整会话和隐藏状态 |
| `POST` | `/api/training/sessions/{session_id}/turns` | 发送用户回答并取得角色下一轮 |
| `POST` | `/api/training/sessions/{session_id}/hint` | 获取当前轮的情境化解题提示 |
| `POST` | `/api/training/sessions/{session_id}/finish` | 结束训练并取得结构化复盘；重复调用返回同一份结果 |

## 对话顾问知识包

`zenmeban-dialogue-advisor/` 是一个可独立验证和安装的对话分析知识包，包含沟通模式、场景、策略、语气路由、JSON Schema、检索脚本和评测报告。它与网页运行时分离：当前 FastAPI 主流程不依赖它，后续可将其策略检索接入提示和复盘模块。

## 下一步

1. 完成第二个高质量预设场景“亲戚催婚”，包括学习目标、场景卡、角色卡和评测用例。
2. 为智谱对话增加流式输出或更细的加载状态，降低每轮等待感。
3. 用固定用户回答集做角色一致性、重复追问、提示质量和复盘可执行性的自动评测。
4. 增加隐私说明和数据删除入口，再考虑将 SQLite 迁移到托管 PostgreSQL 以支持多用户部署。

## 后续兼容方式

- 新增“亲戚催婚”时，增加场景 JSON 和角色 JSON，复用全部会话接口。
- 自定义训练也复用 `TrainingSession`、`Message` 和 `SessionState`，只改变场景卡来源。
- 复盘器读取相同 `learning_goal_ids` 和会话消息，因此后续场景可复用相同复盘接口。
- 当前仓库层使用 SQLite；后续可换成 PostgreSQL 而不改变 API 格式。
