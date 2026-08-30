# 鼠鼠不倒翁

独立解压小游戏模块。打开即可玩：拖离原位再松手弹飞、上下弹打、长按挤压、双指捏捏。也可点「表情」换成表情包；不选表情时始终是原版鼠鼠脸。

## 本地打开

用浏览器直接打开 `index.html`，或在本目录启动静态服务：

```bash
python3 -m http.server 4173
```

然后访问 `http://localhost:4173/`。

## 上传 GitHub

1. 新建一个空仓库
2. 把本文件夹里的文件全部上传（`index.html`、`assets/`、`README.md`）
3. 若要网页预览，在仓库 Settings → Pages 里选主分支根目录

## 文件说明

```
index.html                 游戏本体（页面、样式、逻辑都在这一份里）
assets/tumbler-faces/      贴到鼠鼠脸上的五官图
assets/tumbler-faces/pack/ 表情栏缩略图
```

## 嵌入到其他页面

```html
<iframe src="index.html" title="鼠鼠不倒翁" allow="autoplay"></iframe>
```

父页面可以用 `postMessage` 通信：

- 游戏就绪：`{ type: "tumbler:ready" }`
- 选中表情：`{ type: "tumbler:sticker-picked", stickerId }`
- 下发身份（可选）：`{ type: "tumbler:identity", stickerId }`

`stickerId` 可选：`default`、`sad`、`cry`、`angry`、`confused`、`happy`。未选择或为 `default` 时保持原版表情。
