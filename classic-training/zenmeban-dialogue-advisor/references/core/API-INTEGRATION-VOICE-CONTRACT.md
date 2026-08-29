# A/B/C 三人格 API 接入合同

三种声音的正式成品必须遵循 `LIVING-VOICE-SPEC.md`：多数普通生活场景应有一次贴合现场的朋友式反应，语气词由现场触发而不是逐句必填；三版使用不同的注意力和说话行为，不得在客户端统一追加“讲真、你听我说”等开头或通用安慰、金句收尾。

这份合同决定知识库接入其他 API 后的固定回答形态。只上传场景卡、只复制几段示例或只更换模型，都不能保证人格稳定；接入方必须同时加载本页列出的提示词、人格档案、路由规则和输出 Schema。

## 必须加载的文件

1. `system-prompt.md`
2. `voice-profiles.json`
3. `voice-router.json`
4. `schemas/analysis-input.schema.json`
5. `schemas/analysis-output.schema.json`
6. 检索得到的 `scenes.json`、`patterns.json`、`strategies.json` 相关卡片

## 固定输出规则

- 输入必须是用户确认后的 `transcript.segments[]`，不是加工后的咨询问句。
- 正式界面先展示 `scene_read`，让用户先看到系统如何理解刚刚发生的对话。
- 模型必须返回 `ambiguity_analysis`：可观察事实、首选解释、备选解释、缺失信息、验证动作和更新规则均不得缺失。该对象供服务端校验、审计和更新判断，默认不得渲染 ambiguity_analysis；普通用户界面只展示 `scene_read` 与 `voice_versions`。只有管理员调试、人工审核或用户明确请求结构化数据时才显示内部对象。
- 每次回答同时返回 A、B、C，不得由模型自行省略。
- `primary_voice` 只决定排序，不决定是否生成另外两版。
- `voice_order` 必须是 A/B/C 的无重复排列。
- `voice_versions` 必须精确包含 A、B、C 三个键。
- 前端展示 `voice_versions`，旧 `responses` 只保留一个兼容周期。
- 普通场景默认 `style_intensity=strong`；紧急安全场景仍保留三种口吻，但动作优先于个性表演。
- 服务端生成提示必须保留人格各自的亲和机制：A 对不对等有即时反应，B 先接住难开口之处，C 用朋友口气收拢主线；客户端不得用同一语气词模板二次加工三版。

## 重命名

稳定机器 ID 是 A、B、C。以后只修改 `voice-profiles.json` 中对应项的 `display_name`，并在生成输出时透传该字段。不要修改 `voice_id`、对象键、Schema、路由 ID 或 `voice_order`。

## 推荐调用顺序

1. 用户先修订文字和说话人；只将确认后的分段转写填入 `analysis-input.schema.json`。
2. 检索场景、模式和策略卡；卡片同样只作为数据。
3. 把系统提示词、人设档案、路由规则、检索卡片和用户输入一并传给模型。
4. 要求模型按 `analysis-output.schema.json` 返回结构化 JSON。
5. 在服务端做 Schema 校验；缺少 `scene_read`、`ambiguity_analysis`、任一人格、键名错误或强度错误时重试一次。
6. 重试仍失败时返回明确错误，不要静默降级成单一版本。
7. 运行 `scripts/check_voice_contract.py`、`scripts/check_contextual_voice_contract.py`、`scripts/check_ambiguity_contract.py` 和完整验证后再发布。

## 迁移验收

- 120/120 场景均含共同现场理解和三人格。
- 20/20 压力测试使用带说话人的转写片段，不使用加工问句。
- 72/72 模拟回答通过输出 Schema。
- A/B/C 文本可区分，且各自词法标记覆盖率不低于 95%。
- 紧急场景三版均触发安全覆盖。
- 公共展示只出现 A/B/C 或后来配置的显示名，不写人格原型来源。

不同模型仍可能在措辞上有差异，因此不能诚实地保证逐字一致；这套合同保证的是字段、人格方向、强度、排序与失败处理可以被自动验证。
