# On Cue

录音转写、对话分析、沟通压力训练和情绪释放整合在同一套移动端网页中。

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
ONCUE_STT_MODEL=gpt-4o-mini-transcribe
```

- `ONCUE_STT_MODEL`：录音转写。
- `ONCUE_ANALYSIS_MODEL`：结合内置知识库生成对话分析。
- `ONCUE_TRAINING_MODEL`：生成训练角色回复。
- 如果 API 服务商不是 OpenAI 兼容地址，需要同步修改 `ONCUE_API_BASE_URL` 和模型名。
- `.env` 已被 Git 忽略；只能提交 `.env.example`，禁止提交真实密钥。

## 验证

```bash
npm run test:oncue
npm run build
```

录音转写会按句拆成独立卡片。每张卡片都可选择“我”“对方”等说话人，也可以输入自定义称呼；确认后才进入知识库分析。
