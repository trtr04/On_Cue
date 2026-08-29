# On Cue

录音转写、对话分析、沟通压力训练和情绪释放整合在同一套移动端网页中。

## 最新团队更新

本版本的功能清单、旧版本升级方法和冲突处理规则见 [TEAM_UPDATE_GUIDE.md](./TEAM_UPDATE_GUIDE.md)。

## 队友本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

打开 `http://localhost:3000`。

## API 配置

在 `.env` 中填写服务端配置：

```text
ONCUE_API_KEY=由项目负责人单独提供
ONCUE_API_BASE_URL=https://api.openai.com/v1
ONCUE_ANALYSIS_MODEL=gpt-4o-mini
ONCUE_TRAINING_MODEL=gpt-4o-mini
ONCUE_DIARIZATION_MODEL=gpt-4o-transcribe-diarize
ONCUE_STT_MODEL=gpt-4o-mini-transcribe
```

- `ONCUE_DIARIZATION_MODEL`：优先执行带说话人标签与时间戳的录音转写。
- `ONCUE_STT_MODEL`：当前服务不支持说话人分离时使用的普通转写兼容模型。
- `ONCUE_ANALYSIS_MODEL`：结合内置知识库生成对话分析。
- `ONCUE_TRAINING_MODEL`：生成训练角色回复。
- 如果 API 服务商不是 OpenAI 兼容地址，需要同步修改 `ONCUE_API_BASE_URL` 和模型名。
- `.env` 已被 Git 忽略；只能提交 `.env.example`，禁止提交真实密钥。

## 验证

```bash
npm run test:oncue
npm run build
```

录音转写会优先按声音区分说话人，再按句拆成独立卡片。默认将首个声音标为“对方”、第二个声音标为“我”；每张卡片仍可人工修改角色和文字，确认后才进入知识库分析。
