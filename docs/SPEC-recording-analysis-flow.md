# Spec: 录音到三角色分析流程修正

## Objective

让用户可以明确开始、暂停/继续和结束录音；结束后逐句确认文字与说话人，补充当前情况，再由三个技能角色分析。

## Assumptions

- 离开首页录音模块或页面进入后台时，立即结束录音并释放麦克风。
- 自定义说话人按句保存，最长 24 个字符，和预设角色使用同一 `speakerId` 输入字段。
- “补充当前情况”仍为分析前必经页面，所有字段可选，不阻止用户继续。

## Commands

- Test: `npm run test:oncue`
- Build: `npm run build`
- Package validation: `python3 classic-training/zenmeban-dialogue-advisor/scripts/validate_package.py`

## Project Structure

- `index.html`：录音、逐句角色与当前情况页面结构
- `app.js`：录音状态机、导航保护、上下文收集
- `styles.css`：移动端控制区与自定义输入样式
- `tests/oncue-integration.test.mjs`：流程回归测试

## Testing Strategy

- 集成测试验证三组控制及页面顺序都存在。
- 构建验证浏览器资源和服务端路由可打包。
- 技能包校验验证三角色资源契约不受影响。

## Boundaries

- Always：录音结束或离页后释放麦克风；用户确认后才分析；用户输入以文本编码渲染。
- Ask first：新增云端录音存储、改变 API 服务商或增加新的敏感数据。
- Never：后台持续监听、把 API 密钥写进前端、跳过逐字稿确认直接分析。

## Success Criteria

- 首页分别显示“开始录音”“暂停/继续”“结束录音”，状态切换不会重建同一段录音。
- 离开录音模块或页面隐藏后，录音停止且音轨全部关闭。
- 分析前显示“补充当前情况”，其内容随当前确认对话一起送入分析。
- 每句话既可点预设角色，也可输入自定义说话人，返回后仍保留。
