import { installPhoneViewportFitting } from "./responsive.js";
import { analyzeConfirmedTranscript, loadKnowledgeBase } from "./knowledge-analysis.js";
import {
  TRAINING_MODULES,
  getTrainingHints,
  getTrainingModule,
} from "./training-game.js";
import {
  createClassicTrainingSession,
  finishClassicTrainingSession,
  getClassicTrainingHint,
  sendClassicTrainingTurn,
} from "./classic-training-api.js";
import {
  blobFromDataUrl,
  formatTranscriptText,
  isTranscriptPlaceholder,
  parseTranscriptTurns,
  serializeTranscriptTurns,
  transcribeAudioBlob,
} from "./transcription.js";

const I18N = {
  "title": "\u9519\u4e0d\u8d77\u6211\u5bf9\u4e86",
  "guide-kicker": "\u9519\u4e0d\u8d77\u6211\u5bf9\u4e86 \u00b7 \u6a21\u62df\u5668",
  "guide-title": "\u628a\u6ca1\u8bf4\u5b8c\u7684\u8bdd\uff0c<br>\u91cd\u65b0\u62ff\u56de\u6765\u3002",
  "guide-copy": "\u5f55\u97f3\u590d\u76d8\u3001\u7ecf\u5178\u5bf9\u7ec3\u3001\u66b4\u51fb\u53d1\u6cc4\u4e0e\u8bbe\u7f6e\u7684\u5b8c\u6574\u53ef\u70b9\u51fb\u6d41\u7a0b\u3002",
  "guide-home": "\u9996\u9875\u4e0e\u5f85\u5206\u6790\u5f55\u97f3",
  "guide-practice": "\u7ecf\u5178\u5bf9\u7ec3\u4e0e\u573a\u666f\u5730\u56fe",
  "guide-vent": "\u60c5\u7eea\u66b4\u51fb",
  "guide-settings": "\u8bbe\u7f6e",
  "guide-note": "录音页会请求麦克风权限；原音频与转写默认仅保存在本机。",
  "phone-label": "\u9519\u4e0d\u8d77\u6211\u5bf9\u4e86 \u79fb\u52a8\u7aef\u6a21\u62df\u5668",
  "app-name": "\u9519\u4e0d\u8d77\u6211\u5bf9\u4e86",
  "app-tagline": "\u8868\u8fbe\u4e0e\u60c5\u7eea\u8bad\u7ec3\u52a9\u624b",
  "home-bubble": "\u68c0\u6d4b\u5230\u4f60\u4eca\u5929\u6709\u53d1\u751f\u4e00\u6b21\u77db\u76fe\uff0c\u8981\u4e0d\u8981\u6f14\u7ec3\u4e00\u4e0b\uff1f",
  "record-cta": "点击开始录音",
  "current-title": "\u4eca\u5929 14:20 \u00b7 \u548c\u5bfc\u5e08\u8ba8\u8bba\u65b9\u6848",
  "save-first": "\u5148\u8bb0\u4e0b\u6765",
  "analyze": "\u5206\u6790\u4e00\u4e0b",
  "saved-title": "\u5f85\u5206\u6790\u7684\u5f55\u97f3",
  "saved-note": "\u5df2\u5b58\u5165\u540e\u7aef\uff0c\u53ef\u968f\u65f6\u56de\u6765\u7ee7\u7eed\u5206\u6790",
  "back": "\u8fd4\u56de\u9996\u9875",
  "recording": "正在录音",
  "live-note": "点击开始录音；停录后先核对转写，再生成对话分析。",
  "marked-initial": "＋ 标记紧张点",
  "transcript": "\u5b9e\u65f6\u8f6c\u5199",
  "analyzing": "AI \u5b9e\u65f6\u5206\u6790\u4e2d\u2026",
  "mentor-time": "\u5bfc\u5e08 \u00b7 02:08",
  "mentor-line": "\u8fd9\u4e2a\u683c\u5f0f\u6211\u4e0d\u662f\u8bf4\u8fc7\u4e86\u5417\uff1f\u4f60\u5230\u5e95\u6709\u6ca1\u6709\u8ba4\u771f\u505a\uff1f",
  "me-time": "\u6211 \u00b7 02:16",
  "me-line": "\u6211\u6539\u8fc7\u4e86\uff0c\u4f46\u662f\u8fd9\u6b21\u6a21\u677f\u548c\u4e0a\u6b21\u4e0d\u4e00\u6837\u2026\u2026",
  "after-record": "停止录音后",
  "save-recording": "保存",
  "direct-analyze": "核对转写",
  "privacy": "原音频与文字会出现在首页待分析记录；只有主动点击时才开始知识库分析。",
  "analysis-done": "\u5f55\u97f3\u5206\u6790\u5b8c\u6210",
  "analysis-title": "\u8fd9\u6bb5\u5bf9\u8bdd\uff0c\u5361\u5728\u54ea\u91cc\uff1f",
  "score-title": "\u903b\u8f91\u662f\u6e05\u695a\u7684\uff0c<br>\u4f46\u8fb9\u754c\u8fd8\u53ef\u4ee5\u66f4\u5177\u4f53\u3002",
  "score-copy": "\u4f60\u88ab\u6253\u65ad\u540e\u8f6c\u5411\u81ea\u8bc1\uff0c\u5bfc\u81f4\u6838\u5fc3\u4f9d\u636e\u6ca1\u6709\u8bf4\u5b8c\u3002",
  "logic": "\u903b\u8f91\u6e05\u6670",
  "emotion": "\u60c5\u7eea\u7a33\u5b9a",
  "boundary": "\u8fb9\u754c\u660e\u786e",
  "action": "\u884c\u52a8\u5177\u4f53",
  "diagnosis": "\u5173\u952e\u8bca\u65ad",
  "peak": "\u60c5\u7eea\u9ad8\u70b9 02:16 \u00b7 \u505c\u987f 4.2 \u79d2",
  "key-dialogue": "\u5bfc\u5e08\uff1a\u201c\u4f60\u5230\u5e95\u6709\u6ca1\u6709\u8ba4\u771f\u505a\uff1f\u201d<br>\u6211\uff1a\u201c\u6211\u2026\u2026\u6211\u6539\u8fc7\u4e86\uff0c\u4f46\u662f\u2026\u2026\u201d",
  "good": "\u2713 \u4f60\u505a\u5f97\u597d\u7684",
  "good-copy": "\u4f60\u6307\u51fa\u4e86\u201c\u8fd9\u6b21\u6a21\u677f\u548c\u4e0a\u6b21\u4e0d\u4e00\u81f4\u201d\uff0c<br>\u628a\u95ee\u9898\u62c9\u56de\u4e86\u4e8b\u5b9e\uff0c\u800c\u4e0d\u662f\u63a5\u53d7\u4eba\u683c\u8bc4\u4ef7\u3002",
  "improve": "\u25b3 \u53ef\u4ee5\u6539\u8fdb\uff1a\u5148\u7ed9\u7ed3\u8bba\uff0c\u4e0d\u6025\u7740\u81ea\u8bc1",
  "improve-copy": "\u5148\u8bf4\u201c\u6211\u5df2\u5b8c\u6210\u4fee\u6539\uff0c\u5f53\u524d\u9700\u8981\u5bf9\u9f50\u6700\u7ec8\u6a21\u677f\u201d\u3002",
  "reply-label": "\u6309\u4f60\u7684\u903b\u8f91\u7ee7\u7eed\u56de\u603c",
  "reply": "\u201c\u6211\u53ef\u4ee5\u4eca\u5929\u91cd\u505a\uff0c\u4f46\u8bf7\u5148\u786e\u8ba4\u4ee5\u54ea\u7248\u6a21\u677f\u4e3a\u51c6\u3002\u201d",
  "coach-title": "\u548c AI \u6559\u7ec3\u8ba8\u8bba",
  "coach-note": "\u7ee7\u7eed\u8ffd\u95ee\u4e3a\u4ec0\u4e48\u8fd9\u6837\u8bf4\uff0c\u6216\u8ba9 AI \u5e2e\u4f60\u6539\u6210\u81ea\u5df1\u7684\u8bed\u6c14\u3002",
  "ai-message": "AI\uff1a\u4f60\u7684\u6838\u5fc3\u4f9d\u636e\u662f\u201c\u6a21\u677f\u53d1\u751f\u53d8\u5316\u201d\u3002<br>\u5148\u8981\u6c42\u786e\u8ba4\u6807\u51c6\uff0c\u80fd\u907f\u514d\u88ab\u5e26\u5165\u81ea\u6211\u6000\u7591\u3002",
  "user-message": "\u5982\u679c\u4ed6\u7ee7\u7eed\u8bf4\u6211\u627e\u501f\u53e3\uff0c\u6211\u600e\u4e48\u63a5\uff1f",
  "coach-placeholder": "\u7ee7\u7eed\u95ee AI\u2026",
  "ask-ai": "\u5411 AI \u6559\u7ec3\u63d0\u95ee",
  "replay": "\u628a\u8fd9\u4e2a\u573a\u666f\u518d\u6f14\u7ec3\u4e00\u904d \u2192",
  "filter-all": "\u5168\u90e8",
  "filter-work": "\u804c\u573a",
  "filter-home": "\u5bb6\u5ead",
  "filter-love": "\u4eb2\u5bc6\u5173\u7cfb",
  "filter-friend": "\u670b\u53cb",
  "today-rec": "\u4eca\u65e5\u63a8\u8350",
  "rec-title": "\u9886\u5bfc\u8d28\u95ee\u9879\u76ee\u8fdb\u5ea6",
  "view-levels": "\u67e5\u770b\u5173\u5361 \u2192",
  "map-title": "\u573a\u666f\u5730\u56fe",
  "map-progress": "\u5df2\u63a2\u7d22 1 / 4",
  "node-home": "\u5bb6",
  "node-home-tag": "\u5bb6\u5ead",
  "node-work": "\u516c\u53f8",
  "node-work-tag": "\u804c\u573a\u8bad\u7ec3",
  "node-locked": "\u5f85\u89e3\u9501",
  "node-net": "\u7f51\u7edc",
  "node-net-tag": "\u7ebf\u4e0a\u6c9f\u901a",
  "create-scene": "+  \u521b\u5efa\u6211\u7684\u573a\u666f",
  "custom-kicker": "\u81ea\u5b9a\u4e49\u573a\u666f",
  "custom-title": "\u628a\u5373\u5c06\u53d1\u751f\u7684\u51b2\u7a81\u5199\u4e0b\u6765",
  "custom-role-label": "\u5bf9\u65b9\u662f\u8c01",
  "custom-role-ph": "\u4f8b\u5982\uff1a\u5bfc\u5e08 / \u9886\u5bfc / \u4eb2\u621a",
  "custom-scene-label": "\u53ef\u80fd\u53d1\u751f\u7684\u573a\u9762",
  "custom-scene-ph": "\u4f8b\u5982\uff1a\u627e\u9886\u5bfc\u8c08\u6da8\u85aa\uff0c\u5bf9\u65b9\u53ef\u80fd\u4f1a\u8bf4\u73b0\u5728\u4e0d\u662f\u65f6\u5019\u3002",
  "custom-start": "\u5f00\u59cb\u9884\u6f14",
  "end-drill": "\u7ed3\u675f",
  "drill-placeholder": "\u6309\u4f60\u7684\u65b9\u5f0f\u8bf4\u4e0b\u53bb\u2026",
  "vent-title": "\u73b0\u5728\uff0c\u5c3d\u7ba1\u66b4\u51fb",
  "vent-copy": "\u4e0d\u8bb2\u9053\u7406\u4e5f\u6ca1\u5173\u7cfb\uff0c\u8fd9\u91cc\u4e0d\u4f1a\u4f24\u5bb3\u4efb\u4f55\u4eba",
  "vent-label": "\u66b4\u51fb\u4e0d\u5012\u7fc1",
  "bang": "\u7830\uff01",
  "vent-cue": "\u70b9\u51fb / \u8fde\u6253 / \u957f\u6309\u84c4\u529b",
  "vent-round": "\u672c\u8f6e\u66b4\u51fb",
  "vent-best": "\u6700\u4f73\u8fde\u51fb",
  "vent-reset": "\u91cd\u65b0\u5f00\u59cb",
  "settings-title": "\u8bbe\u7f6e",
  "settings-summary-title": "Juni \u7684\u8868\u8fbe\u8bad\u7ec3",
  "settings-summary-copy": "\u5df2\u8bb0\u5f55 6 \u6b21 \u00b7 \u5b8c\u6210 12 \u6b21\u5bf9\u7ec3",
  "set-device": "\u5f55\u97f3\u8bbe\u5907",
  "set-device-v": "\u5df2\u8fde\u63a5  \u203a",
  "set-haptics": "\u58f0\u97f3\u4e0e\u9707\u52a8",
  "set-haptics-v": "\u6807\u51c6  \u203a",
  "set-notify": "\u901a\u77e5\u63d0\u9192",
  "set-notify-v": "\u5df2\u5f00\u542f  \u203a",
  "set-privacy": "\u5f55\u97f3\u9690\u79c1",
  "set-privacy-v": "\u4ec5\u672c\u673a  \u203a",
  "set-export": "\u6570\u636e\u4e0e\u5bfc\u51fa",
  "set-about": "\u5173\u4e8e\u4e0e\u5e2e\u52a9"
};

const COPY = {
  "seedTitle": "\u5bb6\u5ead\u805a\u9910 \u00b7 \u88ab\u8ffd\u95ee\u8ba1\u5212",
  "seedMeta": "昨天 19:32 · 02:08 · 已保存",
  "analyzeNow": "查看分析",
  "savedTitle": "\u5bfc\u5e08\u529e\u516c\u5ba4 \u00b7 \u65b9\u6848\u4fee\u6539",
  "savedMeta": "今天 14:20 · 03:42 · 已保存",
  "toastSaved": "录音已保存，可随时回来分析",
  "liveTitle": "刚刚的冲突 · 原音频记录",
  "justNow": "\u521a\u521a",
  "stored": "已保存",
  "toastLiveSaved": "原音频与转写已保存",
  "marked": "\u2713 \u5df2\u6807\u8bb0\u7d27\u5f20\u70b9",
  "toastMarked": "\u7d27\u5f20\u65f6\u523b\u5df2\u6807\u8bb0",
  "toastRecordingStarted": "开始录音了，说完后再点一次结束",
  "toastRecordingPaused": "录音已暂停",
  "toastRecordingResumed": "继续录音",
  "toastRecordingStopped": "录音已结束，可以核对转写或先保存",
  "toastRecordingRequired": "请先开始并停止一次录音",
  "toastTranscriptionFallback": "当前浏览器不支持实时转写，停录后会根据音频生成文本",
  "toastTranscribing": "正在转写录音…",
  "toastTranscribeLocal": "正在加载本地识别模型，第一次会稍慢",
  "toastTranscribed": "转写已生成，请逐句核对",
  "toastTranscribeFailed": "自动转写暂时失败，可手动输入或重新转写",
  "toastTranscribeNoAudio": "没有可转写的音频",
  "transcriptPlaceholder": "转写内容会显示在这里，可逐句修改后再分析。",
  "transcriptLoading": "正在整理录音转写…",
  "transcriptLocalLoading": "首次转写需要加载识别模型，请稍等…",
  "transcriptEmptyAudio": "没有录到音频，请重新录音，或直接在这里输入文字。",
  "transcriptStatusReady": "停录后先核对转写，再补充对话背景",
  "transcriptStatusLoading": "正在整理录音转写",
  "transcriptStatusDone": "请确认每句话及其说话人",
  "transcriptStatusError": "转写失败，请手动输入或重试",
  "toastReplay": "\u5df2\u8fdb\u5165\u5bf9\u5e94\u573a\u666f\u5bf9\u7ec3",
  "toastNoop": "\u672c\u6b21\u6a21\u62df\u5668\u805a\u7126\u5f55\u97f3\u590d\u76d8\u6d41\u7a0b",
  "toastLocked": "\u8fd9\u4e2a\u573a\u666f\u8fd8\u5728\u89e3\u9501\u4e2d",
  "toastCustom": "\u573a\u666f\u5df2\u521b\u5efa\uff0c\u5f00\u59cb\u9884\u6f14",
  "toastEndDrill": "\u5bf9\u7ec3\u7ed3\u675f\uff0c\u8fb9\u754c\u6bd4\u521a\u624d\u66f4\u6e05\u695a\u4e00\u70b9\u4e86",
  "combo": "\u8fde\u7eed\u66b4\u51fb  {n}",
  "bangBig": "\u7830\u7830\uff01",
  "ventComplete": "\u91ca\u653e\u5b8c\u6210\uff01\u6df1\u547c\u5438\uff0c\u4f60\u5df2\u7ecf\u628a\u8fd9\u8f6e\u60c5\u7eea\u63a5\u4f4f\u4e86\u3002",
  "ventReset": "\u65b0\u4e00\u8f6e\u5df2\u5f00\u59cb",
  "endSuggest": "\u7ed3\u675f\u5bf9\u7ec3\uff0c\u53bb\u770b\u56de\u603c\u5efa\u8bae",
  "opponent": "\u5bf9\u65b9",
  "customTitle": "\u81ea\u5b9a\u4e49\u9884\u6f14",
  "customOpener": "\u4f60\u73b0\u5728\u628a\u8fd9\u4ef6\u4e8b\u8bf4\u6e05\u695a\u3002",
  "aiResponse": "\u53ef\u4ee5\u628a\u5bf9\u8bdd\u62c9\u56de\u4efb\u52a1\u672c\u8eab\uff1a\u201c\u8fd9\u4e0d\u662f\u627e\u501f\u53e3\uff0c\u6211\u662f\u5728\u786e\u8ba4\u6267\u884c\u6807\u51c6\u3002\u8bf7\u60a8\u660e\u786e\u6700\u7ec8\u6a21\u677f\uff0c\u6211\u4f1a\u6309\u786e\u8ba4\u540e\u7684\u7248\u672c\u5b8c\u6210\u3002\u201d",
  "toastSettings": {
    "profile": "\u4e2a\u4eba\u8d44\u6599\u9875\u5c06\u5728\u4e0b\u4e00\u9636\u6bb5\u63a5\u5165",
    "device": "\u5f55\u97f3\u8bbe\u5907\u5df2\u8fde\u63a5\uff08\u6f14\u793a\uff09",
    "haptics": "\u58f0\u97f3\u4e0e\u9707\u52a8\u4fdd\u6301\u6807\u51c6",
    "notify": "\u901a\u77e5\u63d0\u9192\u5df2\u5f00\u542f",
    "privacy": "\u5f55\u97f3\u4ec5\u4fdd\u5b58\u5728\u672c\u673a",
    "export": "\u5bfc\u51fa\u529f\u80fd\u5c06\u5728\u4e0b\u4e00\u9636\u6bb5\u63a5\u5165",
    "about": "\u9519\u4e0d\u8d77\u6211\u5bf9\u4e86 v1.0 \u00b7 \u8868\u8fbe\u4e0e\u60c5\u7eea\u8bad\u7ec3\u52a9\u624b"
  },
  "toastSettingsSaved": "设置已保存",
  "toastSettingsLocal": "后端暂时不可用，已先保存在本机",
  "toastSettingsLoadedLocal": "暂时读不到后端设置，已使用本机设置",
  "toastSettingsReset": "已恢复默认设置",
  "toastExportPreview": "导出预览已生成",
  "toastBluetoothPending": "蓝牙硬件连接将在下一轮迭代接入",
  "toastVentFaceReady": "人脸已经贴到鼠鼠上了",
  "toastVentFaceFailed": "这张图读不出来，换一张试试",
  "toastVentIdentityCleared": "已经恢复成原来的鼠鼠"
};

const MAP_NODES = {
  "home": {
    "kicker": "\u5bb6 \u00b7 2\u4e2a\u8bad\u7ec3\u573a\u666f",
    "title": "\u4eb2\u621a\u50ac\u5a5a\u600e\u4e48\u63a5",
    "scene": "home",
    "icon": "/assets/map-icon-house.svg"
  },
  "work": {
    "kicker": "\u516c\u53f8 \u00b7 3\u4e2a\u8bad\u7ec3\u573a\u666f",
    "title": "\u9886\u5bfc\u8d28\u95ee\u9879\u76ee\u8fdb\u5ea6",
    "scene": "work",
    "icon": "/assets/map-icon-company.svg"
  },
  "net": {
    "kicker": "\u7f51\u7edc \u00b7 2\u4e2a\u8bad\u7ec3\u573a\u666f",
    "title": "\u7ebf\u4e0a\u88ab\u5f53\u4f17\u8d28\u7591",
    "scene": "net",
    "icon": "/assets/map-icon-globe.svg"
  }
};

const LEVELS = {
  "work": {
    "kicker": "\u516c\u53f8 \u00b7 \u804c\u573a\u8bad\u7ec3",
    "title": "\u9009\u62e9\u5173\u5361",
    "items": [
      {
        "id": "progress",
        "role": "\u9886\u5bfc",
        "title": "\u9886\u5bfc\u8d28\u95ee\u9879\u76ee\u8fdb\u5ea6",
        "copy": "\u201c\u8fd9\u4e2a\u683c\u5f0f\u6211\u4e0d\u662f\u8bf4\u8fc7\u4e86\u5417\uff1f\u201d"
      },
      {
        "id": "public",
        "role": "\u5bfc\u5e08",
        "title": "\u88ab\u5f53\u4f17\u6279\u8bc4\u65b9\u6848",
        "copy": "\u4f1a\u8bae\u5ba4\u91cc\u7a81\u7136\u88ab\u70b9\u540d\u8fd4\u5de5\u3002"
      },
      {
        "id": "overtime",
        "role": "\u4e3b\u7ba1",
        "title": "\u52a0\u73ed\u5374\u88ab\u8d28\u7591\u6001\u5ea6",
        "copy": "\u5df2\u7ecf\u6539\u5230\u5f88\u665a\uff0c\u8fd8\u88ab\u8bf4\u4e0d\u591f\u8ba4\u771f\u3002"
      }
    ]
  },
  "home": {
    "kicker": "\u5bb6 \u00b7 \u5bb6\u5ead\u8bad\u7ec3",
    "title": "\u9009\u62e9\u5173\u5361",
    "items": [
      {
        "id": "marriage",
        "role": "\u4eb2\u621a",
        "title": "\u4eb2\u621a\u50ac\u5a5a\u600e\u4e48\u63a5",
        "copy": "\u996d\u684c\u4e0a\u88ab\u8ffd\u95ee\u4ec0\u4e48\u65f6\u5019\u7a33\u5b9a\u4e0b\u6765\u3002"
      },
      {
        "id": "compare",
        "role": "\u957f\u8f88",
        "title": "\u88ab\u62ff\u6765\u548c\u522b\u4eba\u6bd4\u8f83",
        "copy": "\u201c\u4f60\u770b\u4eba\u5bb6\u5b69\u5b50\u591a\u61c2\u4e8b\u3002\u201d"
      }
    ]
  },
  "net": {
    "kicker": "\u7f51\u7edc \u00b7 \u7ebf\u4e0a\u6c9f\u901a",
    "title": "\u9009\u62e9\u5173\u5361",
    "items": [
      {
        "id": "group",
        "role": "\u540c\u4e8b",
        "title": "\u7fa4\u91cc\u88ab\u5f53\u4f17\u8d28\u7591",
        "copy": "\u5de5\u4f5c\u7fa4\u91cc\u7a81\u7136\u88ab\u70b9\u540d\u89e3\u91ca\u3002"
      },
      {
        "id": "delay",
        "role": "\u7532\u65b9",
        "title": "\u6d88\u606f\u5df2\u8bfb\u4e0d\u56de\u540e\u88ab\u50ac",
        "copy": "\u5bf9\u65b9\u89c9\u5f97\u4f60\u5728\u56de\u907f\u95ee\u9898\u3002"
      }
    ]
  }
};

const DRILLS = {
  "progress": {
    "role": "\u9886\u5bfc",
    "title": "\u9886\u5bfc\u8d28\u95ee\u9879\u76ee\u8fdb\u5ea6",
    "opener": "\u8fd9\u4e2a\u683c\u5f0f\u6211\u4e0d\u662f\u8bf4\u8fc7\u4e86\u5417\uff1f\u4f60\u5230\u5e95\u6709\u6ca1\u6709\u8ba4\u771f\u505a\uff1f",
    "suggestions": [
      "\u6211\u6539\u8fc7\u4e86\uff0c\u4f46\u8fd9\u6b21\u6a21\u677f\u548c\u4e0a\u6b21\u4e0d\u4e00\u6837\u3002",
      "\u8bf7\u5148\u786e\u8ba4\u6700\u7ec8\u6a21\u677f\uff0c\u6211\u53ef\u4ee5\u4eca\u5929\u91cd\u505a\u3002",
      "\u6211\u60f3\u5148\u628a\u95ee\u9898\u62c9\u56de\u4e8b\u5b9e\u4e0a\u3002"
    ],
    "replies": [
      "\u90a3\u4f60\u89e3\u91ca\u4e00\u4e0b\uff0c\u4e3a\u4ec0\u4e48\u5230\u73b0\u5728\u8fd8\u6ca1\u5bf9\u9f50\uff1f",
      "\u6211\u8981\u7684\u662f\u7ed3\u679c\u3002\u4f60\u73b0\u5728\u80fd\u7ed9\u51fa\u4ec0\u4e48\uff1f",
      "\u884c\u3002\u90a3\u4f60\u4eca\u5929\u628a\u786e\u8ba4\u540e\u7684\u7248\u672c\u53d1\u6211\u3002"
    ]
  },
  "public": {
    "role": "\u5bfc\u5e08",
    "title": "\u88ab\u5f53\u4f17\u6279\u8bc4\u65b9\u6848",
    "opener": "\u8fd9\u4e2a\u65b9\u6848\u5b8c\u5168\u4e0d\u662f\u6211\u8981\u7684\uff0c\u4f60\u56de\u53bb\u91cd\u505a\u3002",
    "suggestions": [
      "\u6211\u8bb0\u4e0b\u4e86\uff0c\u8bf7\u544a\u8bc9\u6211\u6700\u9700\u8981\u6539\u7684\u4e24\u70b9\u3002",
      "\u6211\u53ef\u4ee5\u4f1a\u540e\u5355\u72ec\u5bf9\u9f50\uff0c\u907f\u514d\u5360\u7528\u5927\u5bb6\u65f6\u95f4\u3002",
      "\u6211\u5148\u786e\u8ba4\u6700\u7ec8\u6807\u51c6\uff0c\u518d\u6309\u8fd9\u4e2a\u6539\u3002"
    ],
    "replies": [
      "\u6700\u91cd\u8981\u7684\u662f\u7ed3\u6784\u548c\u7ed3\u8bba\uff0c\u73b0\u5728\u90fd\u592a\u6563\u3002",
      "\u597d\uff0c\u90a3\u5c31\u6309\u8fd9\u4e24\u70b9\u6539\uff0c\u660e\u5929\u4e0b\u5348\u524d\u7ed9\u6211\u3002"
    ]
  },
  "overtime": {
    "role": "\u4e3b\u7ba1",
    "title": "\u52a0\u73ed\u5374\u88ab\u8d28\u7591\u6001\u5ea6",
    "opener": "\u770b\u8d77\u6765\u4f60\u8fd8\u662f\u4e0d\u591f\u4e0a\u5fc3\u554a\u3002",
    "suggestions": [
      "\u6211\u6628\u665a\u5df2\u7ecf\u6539\u5230\u7ec8\u7248\uff0c\u5361\u5728\u6a21\u677f\u6ca1\u6709\u6700\u7ec8\u786e\u8ba4\u3002",
      "\u6211\u5728\u610f\u8fd9\u4ef6\u4e8b\uff0c\u6240\u4ee5\u60f3\u5148\u5bf9\u9f50\u6807\u51c6\u3002",
      "\u8bf7\u5177\u4f53\u8bf4\u54ea\u4e00\u90e8\u5206\u8fd8\u6ca1\u8fbe\u5230\u9884\u671f\u3002"
    ],
    "replies": [
      "\u90a3\u4f60\u628a\u65f6\u95f4\u7ebf\u548c\u4ea4\u4ed8\u5217\u51fa\u6765\u3002",
      "\u53ef\u4ee5\u3002\u4f60\u4eca\u5929\u4e0b\u73ed\u524d\u53d1\u6211\u4e00\u7248\u786e\u8ba4\u6e05\u5355\u3002"
    ]
  },
  "marriage": {
    "role": "\u4eb2\u621a",
    "title": "\u4eb2\u621a\u50ac\u5a5a\u600e\u4e48\u63a5",
    "opener": "\u4f60\u90fd\u8fd9\u4e2a\u5c81\u6570\u4e86\uff0c\u8fd8\u4e00\u4e2a\u4eba\uff0c\u5bb6\u91cc\u4e0d\u7740\u6025\u5417\uff1f",
    "suggestions": [
      "\u6211\u73b0\u5728\u66f4\u60f3\u5148\u628a\u81ea\u5df1\u7684\u5de5\u4f5c\u548c\u751f\u6d3b\u8fc7\u7a33\u3002",
      "\u8c22\u8c22\u5173\u5fc3\uff0c\u8fd9\u4ef6\u4e8b\u6211\u4f1a\u6309\u81ea\u5df1\u7684\u8282\u594f\u6765\u3002",
      "\u6211\u4eec\u6362\u4e2a\u8bdd\u9898\u5427\uff0c\u6211\u66f4\u60f3\u542c\u542c\u4f60\u6700\u8fd1\u600e\u4e48\u6837\u3002"
    ],
    "replies": [
      "\u5e74\u8f7b\u4eba\u5c31\u662f\u60f3\u592a\u591a\u3002",
      "\u597d\u597d\u597d\uff0c\u90a3\u4f60\u81ea\u5df1\u6ce8\u610f\u8eab\u4f53\u5c31\u884c\u3002"
    ]
  },
  "compare": {
    "role": "\u957f\u8f88",
    "title": "\u88ab\u62ff\u6765\u548c\u522b\u4eba\u6bd4\u8f83",
    "opener": "\u4f60\u770b\u4eba\u5bb6\u5b69\u5b50\u591a\u61c2\u4e8b\uff0c\u4f60\u600e\u4e48\u8fd8\u662f\u8fd9\u6837\u3002",
    "suggestions": [
      "\u6211\u4e0d\u60f3\u88ab\u8fd9\u6837\u6bd4\u8f83\uff0c\u6211\u4eec\u53ef\u4ee5\u8bf4\u5177\u4f53\u7684\u4e8b\u60c5\u3002",
      "\u6211\u6709\u6211\u7684\u5b89\u6392\uff0c\u8bf7\u5148\u542c\u6211\u8bf4\u5b8c\u3002",
      "\u8fd9\u6837\u8bf4\u6211\u4f1a\u5f88\u96be\u7ee7\u7eed\u804a\u4e0b\u53bb\u3002"
    ],
    "replies": [
      "\u6211\u8fd8\u4e0d\u662f\u4e3a\u4f60\u597d\u3002",
      "\u90a3\u4f60\u81ea\u5df1\u770b\u7740\u529e\u5427\u3002"
    ]
  },
  "group": {
    "role": "\u540c\u4e8b",
    "title": "\u7fa4\u91cc\u88ab\u5f53\u4f17\u8d28\u7591",
    "opener": "\u8fd9\u4e2a\u4e8b\u4f60\u600e\u4e48\u8fd8\u6ca1\u56de\uff1f\u662f\u4e0d\u662f\u6ca1\u5f53\u56de\u4e8b\uff1f",
    "suggestions": [
      "\u6211\u770b\u5230\u4e86\uff0c\u6b63\u5728\u6838\u5bf9\u6570\u636e\uff0c\u5341\u5206\u949f\u5185\u56de\u590d\u7ed3\u8bba\u3002",
      "\u6211\u79c1\u804a\u4f60\u7ec6\u8282\uff0c\u907f\u514d\u7fa4\u91cc\u4fe1\u606f\u4e0d\u540c\u6b65\u3002",
      "\u8bf7\u5148\u544a\u8bc9\u6211\u4f60\u6700\u6025\u7684\u662f\u54ea\u4e00\u9879\u3002"
    ],
    "replies": [
      "\u90a3\u5c31\u5feb\u4e00\u70b9\uff0c\u5927\u5bb6\u90fd\u5728\u7b49\u3002",
      "\u884c\uff0c\u90a3\u4f60\u79c1\u804a\u53d1\u6211\u3002"
    ]
  },
  "delay": {
    "role": "\u7532\u65b9",
    "title": "\u6d88\u606f\u5df2\u8bfb\u4e0d\u56de\u540e\u88ab\u50ac",
    "opener": "\u5df2\u8bfb\u4e0d\u56de\u662f\u4ec0\u4e48\u610f\u601d\uff1f\u662f\u4e0d\u662f\u4e0d\u60f3\u505a\u4e86\uff1f",
    "suggestions": [
      "\u4e0d\u662f\u56de\u907f\u3002\u6211\u5728\u786e\u8ba4\u53ef\u884c\u65b9\u6848\uff0c\u73b0\u5728\u56de\u590d\u4f60\u3002",
      "\u5f53\u524d\u5361\u5728\u8303\u56f4\u786e\u8ba4\uff0c\u786e\u8ba4\u540e\u6211\u9a6c\u4e0a\u6392\u671f\u3002",
      "\u6211\u53ef\u4ee5\u5148\u7ed9\u4e00\u4e2a\u4e34\u65f6\u7ed3\u8bba\uff0c\u5b8c\u6574\u65b9\u6848\u4eca\u665a\u53d1\u3002"
    ],
    "replies": [
      "\u90a3\u5c31\u5148\u7ed9\u6211\u4e34\u65f6\u7ed3\u8bba\u3002",
      "\u4eca\u665a\u52a1\u5fc5\u53d1\u8fc7\u6765\u3002"
    ]
  },
  "custom": {
    "role": "\u5bf9\u65b9",
    "title": "\u81ea\u5b9a\u4e49\u9884\u6f14",
    "opener": "\u4f60\u73b0\u5728\u628a\u8fd9\u4ef6\u4e8b\u8bf4\u6e05\u695a\u3002",
    "suggestions": [
      "\u6211\u60f3\u5148\u786e\u8ba4\u6211\u4eec\u8ba8\u8bba\u7684\u5177\u4f53\u95ee\u9898\u3002",
      "\u8bf7\u8ba9\u6211\u8bf4\u5b8c\uff0c\u6211\u518d\u542c\u4f60\u7684\u7acb\u573a\u3002",
      "\u6211\u53ef\u4ee5\u6539\uff0c\u4f46\u9700\u8981\u5148\u5bf9\u9f50\u6807\u51c6\u3002"
    ],
    "replies": [
      "\u90a3\u4f60\u8bf4\u3002",
      "\u6211\u542c\u7740\uff0c\u4f60\u7ed9\u4e00\u4e2a\u660e\u786e\u7ed3\u8bba\u3002"
    ]
  }
};

function applyLocalization() {
  document.title = I18N.title;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = I18N[node.dataset.i18n] || "";
  });
  document.querySelectorAll("[data-i18n-html]").forEach((node) => {
    node.innerHTML = I18N[node.dataset.i18nHtml] || "";
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", I18N[node.dataset.i18nAriaLabel] || "");
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = I18N[node.dataset.i18nPlaceholder] || "";
  });
}

applyLocalization();

const phone = document.querySelector(".phone");
const screens = [...document.querySelectorAll("[data-screen]")];
const guides = [...document.querySelectorAll("[data-jump]")];
const savedList = document.querySelector("#saved-list");
const timerElement = document.querySelector("#timer");
const toast = document.querySelector("#toast");
const mapDetail = document.querySelector("#map-detail");
const levelsList = document.querySelector("#levels-list");
const drillThread = document.querySelector("#drill-thread");
const drillSuggestions = document.querySelector("#drill-suggestions");
const drillProgress = document.querySelector("#drill-progress");
const drillForm = document.querySelector("#drill-form");
const mouseGameFrame = document.querySelector("#mouse-game-frame");
const ventFaceInput = document.querySelector("#vent-face-input");
const ventFacePicker = document.querySelector(".vent-face-picker");
const ventFacePreviewImage = document.querySelector("#vent-face-preview-image");
const ventNameInput = document.querySelector("#vent-name-input");
const ventIdentityClear = document.querySelector("#vent-identity-clear");
const confirmedTranscript = document.querySelector("#confirmed-transcript");
const analysisScreen = document.querySelector(".analysis-screen");
const homeRecordButton = document.querySelector("#home-record-control");
const homeRecordLabel = document.querySelector("#home-record-label");
const homeRecordHelper = document.querySelector("#home-record-helper");
const recordingReviewSheet = document.querySelector("#recording-review-sheet");
const recordingStatus = document.querySelector("#recording-status");
const recordingStatusLabel = document.querySelector("#recording-status-label");
const recordingHelper = document.querySelector("#recording-helper");
const startRecordingButton = document.querySelector("#start-recording");
const recordingControls = document.querySelector("#recording-controls");
const recordingAudioCard = document.querySelector("#recording-audio-card");
const recordingAudio = document.querySelector("#recording-audio");
const recordingSheetAudio = document.querySelector("#recording-sheet-audio");
const saveRecordingButton = document.querySelector("#save-recording");
const analyzeRecordingButton = document.querySelector("#analyze-recording");
const transcriptStatus = document.querySelector("#transcript-status");
const retranscribeButton = document.querySelector("#retranscribe-button");
const transcriptTurnsList = document.querySelector("#transcript-turns");
const addTurnButton = document.querySelector("[data-action='add-turn']");
const humorToggle = document.querySelector("#context-humor");

const STORAGE_KEY = "on-cue-demo-recordings";
const SETTINGS_STORAGE_KEY = "on-cue-user-settings";
const VENT_IDENTITY_KEY = "on-cue-vent-identity";
const DEFAULT_TRANSCRIPT = `${I18N["mentor-line"] ? `导师：${I18N["mentor-line"]}` : ""}\n我：${I18N["me-line"]}`;
const seedRecordings = [{ id: "family-dinner", title: COPY.seedTitle, meta: COPY.seedMeta, transcript: DEFAULT_TRANSCRIPT }];
const SETTINGS_SCREENS = {
  profile: "settings-profile",
  device: "settings-device",
  haptics: "settings-haptics",
  notify: "settings-notify",
  privacy: "settings-privacy",
  export: "settings-export",
  about: "settings-about",
};
const DEFAULT_APP_SETTINGS = {
  profile: {
    displayName: "Juni",
    phoneMasked: "138****0000",
    trainingGoal: "表达训练与冲突复盘",
  },
  device: {
    input: "system",
    bluetoothDevice: "未连接线下设备",
    hardwareAutoConnect: false,
    noiseSuppression: true,
    autoTranscribe: true,
  },
  haptics: {
    sound: true,
    vibration: true,
    intensity: "standard",
  },
  notify: {
    enabled: true,
    reminderTime: "21:30",
    frequency: "daily",
  },
  privacy: {
    storage: "local",
    keepAudio: true,
    analysisConsent: false,
  },
  export: {
    format: "markdown",
    includeAudio: false,
  },
};
const SPEAKER_PRESETS = ["待确认", "我", "对方", "导师", "领导", "家人"];
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recordings = loadRecordings();
let elapsed = 0;
let timerId = null;
let toastId = null;
let recordingState = "ready";
let mediaRecorder = null;
let recordedChunks = [];
let audioStream = null;
let recordedAudioUrl = "";
let recordedAudioDataUrl = "";
let recordedAudioBlob = null;
let speechRecognition = null;
let speechFinalText = "";
let speechInterimText = "";
let shouldRestartRecognition = false;
let currentScreen = "home";
let selectedMap = "work";
let drillOrigin = "levels";
let currentDrill = null;
let currentTrainingSession = null;
let drillStep = 0;
let boundaryWins = 0;
let selectedClassicDifficulty = 1;
let knowledgePromise = null;
let currentKnowledgeAnalysis = null;
let selectedKnowledgeVoice = "A";
let currentDraftRecordingId = "";
let currentDraftTitle = COPY.liveTitle;
let currentDraftMeta = "";
let transcriptionToken = 0;
let transcriptEditedByUser = false;
let transcribing = false;
let transcriptTurns = [];
let originalTranscriptTurns = [];
let transcriptMode = "draft";
let nextTurnId = 1;
let analysisHumor = true;
let settingsState = loadCachedSettings();

function loadRecordings() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(value) ? value : seedRecordings;
  } catch {
    return seedRecordings;
  }
}

function persistRecordings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
}

function getTranscriptText() {
  if (transcriptTurns.length) return serializeTranscriptTurns(transcriptTurns);
  return String(confirmedTranscript?.value || "").trim();
}

function syncContinueButton() {
  if (!analyzeRecordingButton) return;
  analyzeRecordingButton.disabled =
    recordingState !== "stopped" || transcribing || isTranscriptPlaceholder(getTranscriptText());
}

function setTranscriptText(text, { snapshotOriginal = false } = {}) {
  const value = String(text || "");
  if (confirmedTranscript) confirmedTranscript.value = value;
  if (isTranscriptPlaceholder(value) || !value.trim()) {
    transcriptTurns = [];
    originalTranscriptTurns = [];
    transcriptMode = "draft";
    renderTranscriptTurns();
    syncContinueButton();
    return;
  }
  transcriptTurns = parseTranscriptTurns(value).map((turn) => ({
    id: `turn-${nextTurnId++}`,
    speaker: turn.speaker || "我",
    text: turn.text || "",
  }));
  if (snapshotOriginal || originalTranscriptTurns.length === 0) {
    originalTranscriptTurns = transcriptTurns.map((turn) => ({ ...turn, id: `orig-${turn.id}` }));
  }
  renderTranscriptTurns();
  syncContinueButton();
}

function syncTranscriptFromTurns() {
  const text = serializeTranscriptTurns(transcriptTurns);
  if (confirmedTranscript) confirmedTranscript.value = text;
  transcriptEditedByUser = Boolean(text);
  syncContinueButton();
}

function renderTranscriptTurns() {
  if (!transcriptTurnsList) return;
  const source = transcriptMode === "original" ? originalTranscriptTurns : transcriptTurns;
  const readOnly = transcriptMode === "original";
  document.querySelectorAll("[data-transcript-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.transcriptMode === transcriptMode);
  });
  if (addTurnButton) addTurnButton.hidden = readOnly;
  if (!source.length) {
    transcriptTurnsList.innerHTML = `<article class="empty-history">暂无可编辑的转写。停录后进入“核对转写”，系统会按说话人拆分。</article>`;
    return;
  }
  transcriptTurnsList.innerHTML = source
    .map((turn, index) => {
      const avatar = escapeHtml((turn.speaker || "待确认").slice(0, 1));
      const speakerChips = SPEAKER_PRESETS.map(
        (name) =>
          `<button type="button" class="chip${turn.speaker === name ? " active" : ""}" data-action="set-turn-speaker" data-turn-id="${turn.id}" data-speaker="${escapeHtml(name)}"${readOnly ? " disabled" : ""}>${escapeHtml(name)}</button>`,
      ).join("");
      return `
        <article class="transcript-turn">
          <span class="turn-avatar">${avatar}</span>
          <div class="turn-card${readOnly ? " is-readonly" : ""}">
            <small class="turn-number">第 ${index + 1} 句</small>
            <header>
              <label class="turn-speaker-label" for="speaker-${turn.id}">这句话是谁说的？</label>
              <input id="speaker-${turn.id}" data-turn-field="speaker" data-turn-id="${turn.id}" value="${escapeHtml(turn.speaker || "待确认")}" ${readOnly ? "readonly" : ""} aria-label="说话人，可输入自定义称呼" />
              <button type="button" class="turn-delete" data-action="delete-turn" data-turn-id="${turn.id}" ${readOnly ? "hidden" : ""} aria-label="删除这句">×</button>
            </header>
            <div class="turn-speakers">${speakerChips}</div>
            <textarea data-turn-field="text" data-turn-id="${turn.id}" ${readOnly ? "readonly" : ""} aria-label="${escapeHtml(turn.speaker || "我")}的对话">${escapeHtml(turn.text || "")}</textarea>
          </div>
        </article>
      `;
    })
    .join("");
}

function findTurn(turnId) {
  return transcriptTurns.find((turn) => turn.id === turnId);
}

function updateTurn(turnId, patch) {
  const turn = findTurn(turnId);
  if (!turn || transcriptMode === "original") return;
  Object.assign(turn, patch);
  syncTranscriptFromTurns();
  renderTranscriptTurns();
}

function addTranscriptTurn() {
  if (transcriptMode === "original") return;
  transcriptTurns.push({ id: `turn-${nextTurnId++}`, speaker: "待确认", text: "" });
  syncTranscriptFromTurns();
  renderTranscriptTurns();
  transcriptTurnsList?.querySelector(".transcript-turn:last-child textarea")?.focus();
}

function deleteTranscriptTurn(turnId) {
  if (transcriptMode === "original") return;
  if (transcriptTurns.length <= 1) {
    transcriptTurns = [];
  } else {
    transcriptTurns = transcriptTurns.filter((turn) => turn.id !== turnId);
  }
  syncTranscriptFromTurns();
  renderTranscriptTurns();
}

function collectAnalysisContext() {
  const relationship = document.querySelector("#context-relationship")?.value.trim() || "";
  const occasion = document.querySelector("#context-occasion")?.value.trim() || "";
  const feeling = document.querySelector("#context-feeling")?.value.trim() || "";
  const goal = document.querySelector("#context-goal")?.value.trim() || "";
  return [
    relationship ? `关系：${relationship}` : "",
    occasion ? `场合：${occasion}` : "",
    feeling ? `感受：${feeling}` : "",
    goal ? `目标：${goal}` : "",
    analysisHumor ? "希望在低风险时提供幽默回复" : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function setContextChip(group, value) {
  document.querySelectorAll(`[data-context-group="${group}"] .chip`).forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.contextValue === value);
  });
  const field = document.querySelector(`#context-${group}`);
  if (field) field.value = value;
}

function openContextScreen() {
  const text = getTranscriptText();
  if (!text || isTranscriptPlaceholder(text)) {
    showToast("请先确认转写内容");
    return;
  }
  showScreen("context");
}

function cloneSettings(source = DEFAULT_APP_SETTINGS) {
  return JSON.parse(JSON.stringify(source));
}

function mergeAppSettings(base, patch) {
  const merged = cloneSettings(base);
  const incoming = patch && typeof patch === "object" ? patch : {};
  Object.keys(DEFAULT_APP_SETTINGS).forEach((section) => {
    if (!incoming[section] || typeof incoming[section] !== "object") return;
    Object.keys(DEFAULT_APP_SETTINGS[section]).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(incoming[section], key)) {
        merged[section][key] = incoming[section][key];
      }
    });
  });
  return merged;
}

function loadCachedSettings() {
  try {
    return mergeAppSettings(DEFAULT_APP_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)));
  } catch {
    return cloneSettings();
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsState));
}

function getSettingValue(path) {
  return path.split(".").reduce((value, key) => value?.[key], settingsState);
}

function setNestedValue(target, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const bucket = keys.reduce((current, key) => {
    current[key] ||= {};
    return current[key];
  }, target);
  bucket[lastKey] = value;
}

function formatSettingSummary(path, value) {
  const labels = {
    "device.input": { system: "系统默认  ›", headset: "耳机麦克风  ›", phone: "手机麦克风  ›", bluetooth: "蓝牙硬件  ›" },
    "haptics.intensity": { soft: "轻柔  ›", standard: "标准  ›", strong: "强烈  ›" },
    "notify.enabled": { true: "已开启  ›", false: "已关闭  ›" },
    "privacy.storage": { local: "仅本机  ›", cloud: "后端同步  ›" },
    "export.format": { markdown: "Markdown  ›", txt: "纯文本  ›", json: "JSON  ›" },
  };
  if (labels[path]) return labels[path][String(value)] || "";
  return value ?? "";
}

function renderSettings() {
  document.querySelectorAll("[data-settings-value]").forEach((node) => {
    const value = getSettingValue(node.dataset.settingsValue);
    node.textContent = formatSettingSummary(node.dataset.settingsValue, value);
  });
  document.querySelectorAll("[data-settings-form]").forEach((form) => {
    form.querySelectorAll("input[name], select[name], textarea[name]").forEach((field) => {
      const value = getSettingValue(field.name);
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value ?? "";
    });
  });
}

function collectSettingsForm(form) {
  const patch = {};
  form.querySelectorAll("input[name], select[name], textarea[name]").forEach((field) => {
    const value = field.type === "checkbox" ? field.checked : field.value;
    setNestedValue(patch, field.name, value);
  });
  return patch;
}

async function loadSettings({ silent = false } = {}) {
  settingsState = loadCachedSettings();
  renderSettings();
  if (!silent) showToast(COPY.toastSettingsLoadedLocal);
  return settingsState;
}

async function saveSettings(patch) {
  settingsState = mergeAppSettings(settingsState, patch);
  persistSettings();
  renderSettings();
  showToast(COPY.toastSettingsSaved);
}

async function resetSettings() {
  settingsState = cloneSettings();
  persistSettings();
  renderSettings();
  showToast(COPY.toastSettingsReset);
}

function showSettingsHome() {
  showScreen("settings");
  loadSettings({ silent: true });
}

function openSettingsDetail(item) {
  const screen = SETTINGS_SCREENS[item];
  if (!screen) {
    showToast(COPY.toastSettings[item] || COPY.toastNoop);
    return;
  }
  showScreen(screen);
  renderSettings();
  loadSettings({ silent: true });
}

function buildSettingsExport() {
  const payload = {
    exportedAt: new Date().toISOString(),
    settings: settingsState,
    recordings,
  };
  if (settingsState.export.format === "json") return JSON.stringify(payload, null, 2);
  if (settingsState.export.format === "txt") {
    return recordings.map((recording) => `${recording.title}\n${recording.meta}\n${recording.transcript || ""}`).join("\n\n---\n\n");
  }
  return recordings
    .map((recording) => `## ${recording.title}\n\n${recording.meta}\n\n${recording.transcript || "暂无转写"}`)
    .join("\n\n");
}

function previewSettingsExport() {
  const extension = { json: "json", txt: "txt", markdown: "md" }[settingsState.export.format] || "txt";
  const blob = new Blob([buildSettingsExport()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `on-cue-export-preview.${extension}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
  showToast(COPY.toastExportPreview);
}

function waveform() {
  const heights = [12, 24, 18, 33, 27, 16, 30, 14, 21, 10, 26, 18, 31, 16];
  return heights
    .map((height, index) => `<i class="${[3, 4, 10].includes(index) ? "hot" : ""}" style="--h:${height}px"></i>`)
    .join("");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function renderRecordings() {
  if (!savedList) return;
  if (recordings.length === 0) {
    savedList.innerHTML = `<article class="empty-history">暂无录音记录。完成录音后，可以选择“保存”放到这里。</article>`;
    return;
  }
  savedList.innerHTML = recordings
    .map(
      (recording) => `
        <article class="saved-card">
          <strong>${escapeHtml(recording.title)}</strong>
          <div class="meta">${escapeHtml(recording.meta)}</div>
          <div class="saved-bottom">
            ${
              recording.audioDataUrl
                ? `<audio class="saved-audio" controls src="${escapeHtml(recording.audioDataUrl)}"></audio>`
                : `<div class="mini-wave" aria-hidden="true">${waveform()}</div>`
            }
            <button class="figma-button primary" data-action="review-recording" data-recording-id="${recording.id}">查看分析</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function formatTimer(seconds) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function setTimerDisplay(seconds) {
  if (timerElement) timerElement.textContent = formatTimer(seconds);
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    elapsed += 1;
    setTimerDisplay(elapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function setRecordingState(nextState) {
  recordingState = nextState;
  const content = {
    ready: ["点击开始录音", "说完后再点一次结束，会保留原音频并生成转写"],
    recording: ["正在录音，点击结束", "结束后可以核对转写或先保存"],
    paused: ["已暂停", "录音已暂停，点击继续会接着写入同一段音频"],
    processing: ["处理中", "正在生成可回放的原音频，请稍等"],
    stopped: ["录音已结束", "可以核对转写，也可以先保存到录音记录"],
  }[nextState] || ["准备录音", I18N["live-note"]];

  if (homeRecordLabel) homeRecordLabel.textContent = content[0];
  if (homeRecordHelper) homeRecordHelper.textContent = content[1];
  homeRecordButton?.classList.toggle("is-recording", nextState === "recording");
  homeRecordButton?.classList.toggle("is-stopped", nextState === "stopped");
  homeRecordButton?.setAttribute("aria-pressed", String(nextState === "recording"));
  if (homeRecordButton) homeRecordButton.disabled = nextState === "processing";

  if (recordingStatusLabel) recordingStatusLabel.textContent = content[0];
  if (recordingHelper) recordingHelper.textContent = content[1];
  recordingStatus?.classList.toggle("is-ready", nextState === "ready");
  recordingStatus?.classList.toggle("is-paused", nextState === "paused" || nextState === "processing");
  recordingStatus?.classList.toggle("is-stopped", nextState === "stopped");
  if (startRecordingButton) startRecordingButton.hidden = nextState !== "ready";
  if (recordingControls) {
    recordingControls.hidden = !["recording", "paused"].includes(nextState);
    recordingControls.querySelector('[data-action="pause-recording"]').disabled = nextState !== "recording";
    recordingControls.querySelector('[data-action="resume-recording"]').disabled = nextState !== "paused";
    recordingControls.querySelector('[data-action="stop-recording"]').disabled = !["recording", "paused"].includes(nextState);
  }
  if (saveRecordingButton) saveRecordingButton.disabled = nextState !== "stopped";
  syncContinueButton();
  if (retranscribeButton) retranscribeButton.disabled = transcribing || !recordedAudioBlob;
}

function clearRecordedAudio() {
  if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
  recordedAudioUrl = "";
  recordedAudioDataUrl = "";
  recordedAudioBlob = null;
  recordingAudio?.removeAttribute("src");
  recordingSheetAudio?.removeAttribute("src");
  if (recordingAudioCard) recordingAudioCard.hidden = true;
}

function setTranscriptStatus(message, state = "") {
  if (!transcriptStatus) return;
  transcriptStatus.textContent = message;
  transcriptStatus.dataset.state = state;
}

function setTranscribing(isTranscribing) {
  transcribing = isTranscribing;
  if (retranscribeButton) retranscribeButton.disabled = isTranscribing || !recordedAudioBlob;
  syncContinueButton();
}

function applyTranscribedText(text, { force = false } = {}) {
  const next = formatTranscriptText(text);
  if (!next) return false;
  const current = getTranscriptText();
  if (!force && transcriptEditedByUser && current && !isTranscriptPlaceholder(current)) {
    return false;
  }
  setTranscriptText(next, { snapshotOriginal: true });
  transcriptEditedByUser = false;
  return true;
}

async function transcribeAndFill(blob, { force = false, silent = false } = {}) {
  if (!(blob instanceof Blob) || blob.size === 0) {
    if (!speechFinalText.trim() && isTranscriptPlaceholder(getTranscriptText())) {
      setTranscriptText(COPY.transcriptEmptyAudio);
    }
    setTranscriptStatus(COPY.transcriptStatusError, "error");
    setTranscribing(false);
    if (!silent) showToast(COPY.toastTranscribeNoAudio);
    return false;
  }

  const token = ++transcriptionToken;
  setTranscribing(true);
  setTranscriptStatus(COPY.transcriptStatusLoading, "loading");
  if (isTranscriptPlaceholder(getTranscriptText()) || force) {
    setTranscriptText(COPY.transcriptLoading);
    transcriptEditedByUser = false;
  }
  if (!silent) showToast(COPY.toastTranscribing);

  try {
    const result = await transcribeAudioBlob(blob, {
      allowCloud: settingsState.privacy.analysisConsent,
      onStatus: (status) => {
        if (token !== transcriptionToken) return;
        if (status === "local") {
          setTranscriptStatus(COPY.transcriptStatusLoading, "loading");
          if (isTranscriptPlaceholder(getTranscriptText()) || getTranscriptText() === COPY.transcriptLoading) {
            setTranscriptText(COPY.transcriptLocalLoading);
          }
          showToast(COPY.toastTranscribeLocal);
        }
      },
    });
    if (token !== transcriptionToken) return false;
    const applied = applyTranscribedText(result.text, { force });
    setTranscriptStatus(COPY.transcriptStatusDone, "done");
    if (applied) showToast(COPY.toastTranscribed);
    return true;
  } catch (error) {
    console.warn("Transcription failed", error);
    if (token !== transcriptionToken) return false;
    const live = formatTranscriptText(speechFinalText);
    if (live && (force || isTranscriptPlaceholder(getTranscriptText()))) {
      setTranscriptText(live, { snapshotOriginal: true });
      setTranscriptStatus(COPY.transcriptStatusDone, "done");
      return true;
    }
    if (isTranscriptPlaceholder(getTranscriptText()) || getTranscriptText() === COPY.transcriptLoading) {
      setTranscriptText(COPY.toastTranscribeFailed);
    }
    setTranscriptStatus(COPY.transcriptStatusError, "error");
    if (!silent) showToast(COPY.toastTranscribeFailed);
    return false;
  } finally {
    if (token === transcriptionToken) setTranscribing(false);
  }
}

function releaseAudioStream() {
  audioStream?.getTracks().forEach((track) => track.stop());
  audioStream = null;
}

function currentLiveTranscript() {
  const finalText = speechFinalText.trim();
  const interimText = speechInterimText.trim();
  return [
    finalText,
    interimText && recordingState === "recording" ? `（识别中）${interimText}` : "",
  ].filter(Boolean).join("\n");
}

function renderSpeechTranscript() {
  const live = currentLiveTranscript();
  if (!live || transcriptEditedByUser) return;
  setTranscriptText(live, { snapshotOriginal: originalTranscriptTurns.length === 0 });
}

function appendRecognizedText(text) {
  const line = text.trim();
  if (!line) return;
  speechFinalText = `${speechFinalText}${speechFinalText ? "\n" : ""}待确认：${line}`;
  renderSpeechTranscript();
}

function stopSpeechRecognition() {
  shouldRestartRecognition = false;
  speechInterimText = "";
  if (!speechRecognition) {
    renderSpeechTranscript();
    return;
  }
  const activeRecognition = speechRecognition;
  speechRecognition = null;
  activeRecognition.onend = null;
  try {
    activeRecognition.stop();
  } catch {
    activeRecognition.abort?.();
  }
  renderSpeechTranscript();
}

function startSpeechRecognition() {
  if (!SpeechRecognition) {
    showToast(COPY.toastTranscriptionFallback);
    return;
  }
  stopSpeechRecognition();
  shouldRestartRecognition = true;
  const recognition = new SpeechRecognition();
  speechRecognition = recognition;
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = result[0]?.transcript || "";
      if (result.isFinal) appendRecognizedText(text);
      else interim += text;
    }
    speechInterimText = interim;
    renderSpeechTranscript();
  };
  recognition.onerror = (event) => {
    if (!["aborted", "no-speech"].includes(event.error)) showToast(COPY.toastTranscriptionFallback);
  };
  recognition.onend = () => {
    if (shouldRestartRecognition && recordingState === "recording") {
      window.setTimeout(startSpeechRecognition, 250);
    }
  };
  try {
    recognition.start();
  } catch {
    showToast(COPY.toastTranscriptionFallback);
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

function ensureTranscriptReady() {
  if (isTranscriptPlaceholder(getTranscriptText())) {
    const live = formatTranscriptText(speechFinalText);
    if (live) setTranscriptText(live, { snapshotOriginal: originalTranscriptTurns.length === 0 });
  }
}

async function finalizeRecordedAudio({ silent = false } = {}) {
  let audioBlob = null;
  if (recordedChunks.length > 0) {
    const type = mediaRecorder?.mimeType || "audio/webm";
    audioBlob = new Blob(recordedChunks, { type });
    recordedAudioBlob = audioBlob;
    recordedAudioUrl = URL.createObjectURL(audioBlob);
    if (recordingAudio) recordingAudio.src = recordedAudioUrl;
    if (recordingSheetAudio) recordingSheetAudio.src = recordedAudioUrl;
    if (recordingAudioCard) recordingAudioCard.hidden = false;
    recordedAudioDataUrl = await blobToDataUrl(audioBlob);
  } else {
    recordedAudioBlob = null;
    if (recordingAudioCard) recordingAudioCard.hidden = true;
  }
  releaseAudioStream();
  ensureTranscriptReady();
  currentDraftRecordingId ||= `live-${Date.now()}`;
  currentDraftTitle = COPY.liveTitle;
  currentDraftMeta = `${COPY.justNow} · ${formatTimer(Math.max(elapsed, 18))} · ${COPY.stored}`;
  setRecordingState("stopped");
  renderSpeechTranscript();
  if (speechFinalText.trim()) setTranscriptStatus(COPY.transcriptStatusDone, "done");
  setTranscribing(false);
  if (retranscribeButton) retranscribeButton.disabled = !recordedAudioBlob;
  if (currentScreen === "home") recordingReviewSheet.hidden = false;
  if (!silent) showToast(COPY.toastRecordingStopped);
  if (audioBlob && settingsState.device.autoTranscribe && !speechFinalText.trim()) {
    await transcribeAndFill(audioBlob, { silent: true });
  } else if (!audioBlob && !speechFinalText.trim()) {
    setTranscriptText(COPY.transcriptEmptyAudio);
    setTranscriptStatus(COPY.transcriptStatusError, "error");
  }
}

function prepareRecordingSession() {
  stopTimer();
  stopSpeechRecognition();
  releaseAudioStream();
  clearRecordedAudio();
  recordedChunks = [];
  mediaRecorder = null;
  currentDraftRecordingId = "";
  currentDraftTitle = COPY.liveTitle;
  currentDraftMeta = "";
  speechFinalText = "";
  speechInterimText = "";
  transcriptionToken += 1;
  transcriptEditedByUser = false;
  elapsed = 0;
  setTimerDisplay(0);
  setTranscriptText(COPY.transcriptPlaceholder);
  setTranscriptStatus(COPY.transcriptStatusReady, "");
  setTranscribing(false);
  recordingReviewSheet.hidden = true;
  const marker = document.querySelector('[data-action="mark"]');
  if (marker) marker.textContent = I18N["marked-initial"];
  setRecordingState("ready");
  renderSpeechTranscript();
}

async function startRecording() {
  if (recordingState === "recording") return;
  recordingReviewSheet.hidden = true;
  recordedChunks = [];
  currentDraftRecordingId = "";
  currentDraftTitle = COPY.liveTitle;
  currentDraftMeta = "";
  speechFinalText = "";
  speechInterimText = "";
  transcriptionToken += 1;
  transcriptEditedByUser = false;
  elapsed = 0;
  setTimerDisplay(0);
  setTranscriptText(COPY.transcriptPlaceholder);
  setTranscriptStatus(COPY.transcriptStatusReady, "");
  setRecordingState("recording");
  startTimer();
  renderSpeechTranscript();
  showToast(COPY.toastRecordingStarted);

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    startSpeechRecognition();
    showToast(COPY.toastTranscriptionFallback);
    return;
  }

  try {
    startSpeechRecognition();
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (recordingState !== "recording") {
      releaseAudioStream();
      return;
    }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    mediaRecorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size > 0) recordedChunks.push(event.data);
    });
    mediaRecorder.start(250);
    if (!speechRecognition && SpeechRecognition) startSpeechRecognition();
  } catch (error) {
    console.warn("Recording unavailable", error);
    releaseAudioStream();
    startSpeechRecognition();
    showToast(COPY.toastTranscriptionFallback);
  }
}

function pauseRecording() {
  if (recordingState !== "recording") return;
  if (mediaRecorder?.state === "recording") mediaRecorder.pause();
  stopTimer();
  stopSpeechRecognition();
  setRecordingState("paused");
  renderSpeechTranscript();
  showToast(COPY.toastRecordingPaused);
}

function resumeRecording() {
  if (recordingState !== "paused") return;
  if (mediaRecorder?.state === "paused") mediaRecorder.resume();
  setRecordingState("recording");
  startTimer();
  startSpeechRecognition();
  renderSpeechTranscript();
  showToast(COPY.toastRecordingResumed);
}

function stopRecording({ silent = false } = {}) {
  if (!["recording", "paused"].includes(recordingState)) {
    if (!silent) showToast(COPY.toastRecordingRequired);
    return;
  }
  stopTimer();
  stopSpeechRecognition();
  setRecordingState("processing");
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.addEventListener("stop", () => finalizeRecordedAudio({ silent }), { once: true });
    mediaRecorder.stop();
  } else {
    finalizeRecordedAudio({ silent });
  }
}

function showToast(message) {
  clearTimeout(toastId);
  toast.textContent = message;
  toast.classList.add("show");
  toastId = setTimeout(() => toast.classList.remove("show"), 2200);
}

function revealInbox(behavior = "smooth") {
  const inbox = document.querySelector("#home-inbox");
  if (!inbox) return;
  requestAnimationFrame(() => {
    const firstSaved = inbox.querySelector(".saved-card");
    inbox.scrollTo({ top: firstSaved ? firstSaved.offsetTop - 12 : 0, behavior });
  });
}

function showScreen(id, { scrollInbox = false } = {}) {
  const next = screens.find((screen) => screen.dataset.screen === id);
  if (!next) return;
  const previousScreen = currentScreen;
  const prev = screens.find((screen) => screen.classList.contains("active"));

  if (prev && prev !== next) prev.classList.remove("active");
  next.classList.add("active");
  next.setAttribute("aria-hidden", "false");
  screens.forEach((screen) => {
    if (screen !== next) screen.setAttribute("aria-hidden", "true");
  });

  if (!scrollInbox) {
    next.querySelector(".scroll-page")?.scrollTo({ top: 0 });
    next.scrollTop = 0;
    document.querySelector("#home-inbox")?.scrollTo({ top: 0 });
  }

  currentScreen = id;
  const tab = next.dataset.tab || id;
  guides.forEach((guide) => guide.classList.toggle("active", guide.dataset.jump === tab || guide.dataset.jump === id));
  if (previousScreen === "home" && id !== "home" && ["recording", "paused"].includes(recordingState)) {
    stopRecording({ silent: true });
  } else if (id !== "home") {
    stopTimer();
  }
  if (id === "home" && scrollInbox) revealInbox();
  if (id === "vent") sendVentIdentity();
}

function connectMouseGame() {
  sendVentIdentity();
}

function loadVentIdentity() {
  try {
    const value = JSON.parse(localStorage.getItem(VENT_IDENTITY_KEY));
    return {
      name: typeof value?.name === "string" ? value.name : "",
      faceDataUrl: typeof value?.faceDataUrl === "string" ? value.faceDataUrl : "",
    };
  } catch {
    return { name: "", faceDataUrl: "" };
  }
}

let ventIdentity = loadVentIdentity();

function persistVentIdentity() {
  localStorage.setItem(VENT_IDENTITY_KEY, JSON.stringify(ventIdentity));
}

function sendVentIdentity() {
  mouseGameFrame?.contentWindow?.postMessage(
    {
      type: "tumbler:identity",
      name: ventIdentity.name,
      faceDataUrl: ventIdentity.faceDataUrl,
    },
    "*",
  );
}

function renderVentIdentity() {
  const hasFace = Boolean(ventIdentity.faceDataUrl);
  const hasName = Boolean(ventIdentity.name.trim());
  if (ventNameInput && ventNameInput.value !== ventIdentity.name) {
    ventNameInput.value = ventIdentity.name;
  }
  if (ventFacePreviewImage) {
    if (hasFace) {
      ventFacePreviewImage.src = ventIdentity.faceDataUrl;
      ventFacePreviewImage.hidden = false;
    } else {
      ventFacePreviewImage.removeAttribute("src");
      ventFacePreviewImage.hidden = true;
    }
  }
  ventFacePicker?.classList.toggle("has-face", hasFace);
  if (ventIdentityClear) ventIdentityClear.hidden = !(hasFace || hasName);
}

function cropImageToSquareDataUrl(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type).startsWith("image/")) {
      reject(new Error("not-image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        const scale = Math.max(size / Math.max(image.width, 1), size / Math.max(image.height, 1));
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode-failed"));
    };
    image.src = url;
  });
}

function setVentIdentity(patch) {
  ventIdentity = {
    name: patch.name ?? ventIdentity.name,
    faceDataUrl: patch.faceDataUrl ?? ventIdentity.faceDataUrl,
  };
  persistVentIdentity();
  renderVentIdentity();
  sendVentIdentity();
}

async function importVentFace(file) {
  try {
    const faceDataUrl = await cropImageToSquareDataUrl(file);
    setVentIdentity({ faceDataUrl });
    showToast(COPY.toastVentFaceReady);
  } catch {
    showToast(COPY.toastVentFaceFailed);
  }
}

function clearVentIdentity() {
  setVentIdentity({ name: "", faceDataUrl: "" });
  if (ventFaceInput) ventFaceInput.value = "";
  showToast(COPY.toastVentIdentityCleared);
}

mouseGameFrame?.addEventListener("load", connectMouseGame);
window.addEventListener("message", (event) => {
  if (event.source !== mouseGameFrame?.contentWindow) return;
  if (event.data?.type === "tumbler:ready") sendVentIdentity();
});
if (mouseGameFrame?.contentDocument?.readyState === "complete") connectMouseGame();

ventFaceInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (file) await importVentFace(file);
});

ventNameInput?.addEventListener("compositionstart", () => {
  ventNameInput.dataset.composing = "true";
});
ventNameInput?.addEventListener("compositionend", () => {
  ventNameInput.dataset.composing = "false";
  setVentIdentity({ name: ventNameInput.value.slice(0, 12) });
});
ventNameInput?.addEventListener("input", () => {
  if (ventNameInput.dataset.composing === "true") return;
  setVentIdentity({ name: ventNameInput.value.slice(0, 12) });
});

guides.forEach((guide) => {
  guide.addEventListener("click", () => {
    showScreen(guide.dataset.jump);
  });
});

function addRecording(recording) {
  recordings = [recording, ...recordings.filter((item) => item.id !== recording.id)];
  persistRecordings();
  renderRecordings();
}

function buildCurrentRecording() {
  ensureTranscriptReady();
  currentDraftRecordingId ||= `live-${Date.now()}`;
  currentDraftMeta ||= `${COPY.justNow} · ${formatTimer(Math.max(elapsed, 18))} · ${COPY.stored}`;
  return {
    id: currentDraftRecordingId,
    title: currentDraftTitle || COPY.liveTitle,
    meta: currentDraftMeta,
    transcript: getTranscriptText(),
    audioDataUrl: recordedAudioDataUrl,
  };
}

function saveCurrentRecording({ navigateToHistory = true } = {}) {
  if (recordingState !== "stopped") {
    showToast(COPY.toastRecordingRequired);
    return false;
  }
  addRecording(buildCurrentRecording());
  recordingReviewSheet.hidden = true;
  showToast(COPY.toastLiveSaved);
  showScreen(navigateToHistory ? "history" : "home");
  return true;
}

function loadRecordingForReview(recordingId) {
  const recording = recordings.find((item) => item.id === recordingId);
  if (!recording) {
    showToast("没有找到这条历史记录");
    return;
  }
  stopTimer();
  stopSpeechRecognition();
  releaseAudioStream();
  currentDraftRecordingId = recording.id;
  currentDraftTitle = recording.title || COPY.liveTitle;
  currentDraftMeta = recording.meta || `${COPY.justNow} · ${COPY.stored}`;
  recordedAudioDataUrl = recording.audioDataUrl || "";
  recordedAudioBlob = recordedAudioDataUrl ? blobFromDataUrl(recordedAudioDataUrl) : null;
  recordedAudioUrl = "";
  if (recordedAudioDataUrl) {
    recordingAudio.src = recordedAudioDataUrl;
    if (recordingSheetAudio) recordingSheetAudio.src = recordedAudioDataUrl;
  } else {
    recordingAudio.removeAttribute("src");
    recordingSheetAudio?.removeAttribute("src");
  }
  setTranscriptText(recording.transcript || DEFAULT_TRANSCRIPT, { snapshotOriginal: true });
  transcriptEditedByUser = false;
  setTranscriptStatus(recording.transcript ? COPY.transcriptStatusDone : COPY.transcriptStatusReady, recording.transcript ? "done" : "");
  setTranscribing(false);
  if (retranscribeButton) retranscribeButton.disabled = !recordedAudioBlob;
  recordingReviewSheet.hidden = true;
  setRecordingState("stopped");
  showScreen("transcript");
}

function knowledgeBase() {
  knowledgePromise ||= loadKnowledgeBase();
  return knowledgePromise;
}

function setKnowledgeText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value || "—";
}

function renderKnowledgeVoice(voiceId) {
  if (!currentKnowledgeAnalysis) return;
  const voice = currentKnowledgeAnalysis.voices[voiceId];
  if (!voice) return;
  selectedKnowledgeVoice = voiceId;
  document.querySelectorAll("[data-voice]").forEach((button) => {
    button.classList.toggle("active", button.dataset.voice === voiceId);
  });
  setKnowledgeText("#kb-voice-label", `${voice.display_name} · ${voice.tone_tags.join(" · ")}`);
  setKnowledgeText("#kb-voice-headline", voice.headline);
  setKnowledgeText("#kb-voice-analysis", `${voice.position} ${voice.analysis}`);
  setKnowledgeText("#kb-direct-reply", voice.direct_reply);
}

function renderKnowledgeAnalysis(result) {
  currentKnowledgeAnalysis = result;
  const confidenceLabel = { high: "高相关", medium: "相关", low: "相似参考" }[result.confidence];
  const riskLabel = result.riskLevel === "urgent" ? " · 安全优先" : "";
  setKnowledgeText(
    "#kb-status",
    `${result.source === "knowledge+model" ? "智能分析" : "本地分析"} · ${confidenceLabel}${riskLabel}`,
  );
  setKnowledgeText("#kb-match-title", `匹配场景：${result.scene.title}`);
  renderKnowledgeVoice(result.primaryVoice);
}

async function requestGroundedKnowledgeAnalysis(transcript, context) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, context }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `analysis_${response.status}`);
  return payload;
}

async function runKnowledgeAnalysis(transcript) {
  const text = String(transcript || "").trim();
  if (!text) {
    showToast("请先确认转写内容");
    return;
  }
  showScreen("analysis");
  analysisScreen.classList.add("is-loading");
  setKnowledgeText("#kb-status", "正在检索知识库并整理三种视角…");
  try {
    const context = collectAnalysisContext();
    if (settingsState.privacy.analysisConsent) {
      try {
        renderKnowledgeAnalysis(await requestGroundedKnowledgeAnalysis(text, context));
        return;
      } catch {
        // Continue with the packaged on-device knowledge base when the model endpoint is unavailable.
      }
    }
    const knowledge = await knowledgeBase();
    renderKnowledgeAnalysis({
      ...analyzeConfirmedTranscript(text, knowledge, { extra: context }),
      source: "knowledge-local",
    });
  } catch (error) {
    console.error("Knowledge analysis failed", error);
    setKnowledgeText("#kb-status", "知识库读取失败");
    showToast("知识库暂时无法读取，请重试");
  } finally {
    analysisScreen.classList.remove("is-loading");
  }
}

function renderMapDetail(key) {
  const node = MAP_NODES[key];
  if (!node || !mapDetail) return;
  selectedMap = key;
  document.querySelectorAll(".map-node").forEach((button) => {
    button.classList.toggle("selected", button.dataset.map === key);
  });
  mapDetail.innerHTML = `
    <img src="${node.icon}" alt="" />
    <div>
      <small>${node.kicker}</small>
      <strong>${node.title}</strong>
    </div>
    <button class="figma-button primary" data-action="open-levels" data-scene="${node.scene}">${I18N["view-levels"]}</button>
  `;
}

function openLevels(scene) {
  const pack = LEVELS[scene] || LEVELS.work;
  const packagedItems = TRAINING_MODULES.filter((item) => item.domain === scene).map((item) => ({
    id: item.id,
    title: item.title,
    copy: item.summary,
    packaged: true,
  }));
  const items = [...pack.items, ...packagedItems];
  document.querySelector("#levels-kicker").textContent = pack.kicker;
  document.querySelector("#levels-title").textContent = pack.title;
  levelsList.innerHTML = items
    .map(
      (item) => `
        <button class="level-card" data-action="start-drill" data-drill="${item.id}">
          <b>${item.title}${item.packaged ? '<em>技能包</em>' : ""}</b>
          <span>${item.copy}</span>
        </button>
      `,
    )
    .join("");
  showScreen("levels");
}

function appendDrill(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `drill-bubble ${role}`;
  if (role === "ai") {
    const speaker = document.createElement("small");
    speaker.textContent = currentDrill?.role || "对方";
    bubble.appendChild(speaker);
  }
  const message = document.createElement("p");
  message.textContent = text;
  bubble.appendChild(message);
  drillThread.appendChild(bubble);
  drillThread.scrollTop = drillThread.scrollHeight;
}

function renderSuggestions(list) {
  drillSuggestions.innerHTML = list.map((line) => `<button type="button" data-suggest="${line}">${line}</button>`).join("");
}

function updateDrillProgress() {
  if (!currentTrainingSession) {
    drillProgress.textContent = "";
    return;
  }
  const difficulty = ["", "容易", "中等", "困难"][currentTrainingSession.difficulty] || "容易";
  drillProgress.textContent = `沉浸对练 · ${difficulty} · 第 ${Math.min(currentTrainingSession.turn + 1, currentTrainingSession.maxTurns)} / ${currentTrainingSession.maxTurns} 轮 · 已覆盖 ${currentTrainingSession.achievedGoalIds.length} / 5 项能力`;
}

function listCard(title, values) {
  const card = document.createElement("article");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const list = document.createElement("ul");
  (values?.length ? values : ["这轮对话较短，暂时没有足够证据。"] ).forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.appendChild(item);
  });
  card.append(heading, list);
  return card;
}

function renderClassicTrainingReview(review) {
  const target = document.querySelector("#training-review");
  target.replaceChildren();

  const summary = document.createElement("section");
  summary.className = "review-summary-card";
  const summaryText = document.createElement("p");
  summaryText.textContent = review.summary || "本轮训练已经结束。";
  summary.appendChild(summaryText);

  const columns = document.createElement("div");
  columns.className = "review-columns";
  columns.append(
    listCard("做得好的地方", review.strengths),
    listCard("优先改进", review.priority_improvements),
  );

  const dimensions = document.createElement("div");
  dimensions.className = "review-dimensions";
  (review.dimensions || []).forEach((dimension) => {
    const card = document.createElement("article");
    const header = document.createElement("header");
    const name = document.createElement("strong");
    name.textContent = dimension.name;
    const score = document.createElement("span");
    score.textContent = dimension.score == null ? "证据不足" : `${dimension.score}/5`;
    header.append(name, score);
    const evidence = document.createElement("small");
    evidence.textContent = `对话证据：${dimension.evidence || "暂无"}`;
    const feedback = document.createElement("p");
    feedback.textContent = dimension.feedback || "";
    card.append(header, evidence, feedback);
    dimensions.appendChild(card);
  });

  const next = document.createElement("article");
  next.className = "review-next";
  const betterTitle = document.createElement("strong");
  betterTitle.textContent = "换一种更清楚的说法";
  const better = document.createElement("p");
  better.textContent = review.better_response || "下一轮先把事实、边界和下一步说具体。";
  const practiceTitle = document.createElement("strong");
  practiceTitle.textContent = "下一次只练这一点";
  const practice = document.createElement("p");
  practice.textContent = review.next_practice || "换一个场景继续练习。";
  const back = document.createElement("button");
  back.className = "figma-button primary";
  back.dataset.action = "practice";
  back.textContent = "返回场景地图";
  next.append(betterTitle, better, practiceTitle, practice, back);

  target.append(summary, columns, dimensions, next);
  showScreen("review");
}

async function startDrill(id, extra = {}) {
  const trainingModule = getTrainingModule(id);
  currentTrainingSession = null;
  currentDrill = { ...(DRILLS[id] || DRILLS.custom), ...extra };
  if (trainingModule) {
    currentDrill = {
      role: trainingModule.role,
      title: trainingModule.title,
      opener: "",
      suggestions: [],
      replies: [],
    };
  }
  drillOrigin = extra.origin || "levels";
  drillStep = 0;
  boundaryWins = 0;
  const isFamily = id.includes("family");
  const drillScreen = document.querySelector(".drill-screen");
  drillScreen?.classList.toggle("scene-family", isFamily);
  drillScreen?.classList.toggle("scene-workplace", !isFamily);
  drillScreen?.classList.toggle("use-boss-two", /general|overtime|emotional|gender/.test(id));
  document.querySelector(".family-dinner-stage")?.classList.remove("is-softened");
  document.querySelector("#drill-role").textContent = currentDrill.role;
  document.querySelector("#drill-title").textContent = extra.title || currentDrill.title;
  drillThread.innerHTML = "";
  if (currentDrill.opener) appendDrill("ai", currentDrill.opener);
  renderSuggestions(currentDrill.suggestions);
  showScreen("drill");
  if (!trainingModule) {
    drillForm.classList.remove("is-disabled");
    document.querySelector("#drill-input").disabled = false;
    updateDrillProgress();
    return;
  }

  drillForm.classList.add("is-disabled");
  document.querySelector("#drill-input").disabled = true;
  drillProgress.textContent = "正在进入训练场景…";
  try {
    const data = await createClassicTrainingSession(id, selectedClassicDifficulty);
    currentTrainingSession = {
      sessionId: data.session_id,
      turn: data.current_turn,
      maxTurns: data.max_turns,
      difficulty: selectedClassicDifficulty,
      achievedGoalIds: [],
      finished: false,
    };
    appendDrill("ai", data.opponent_message);
    renderSuggestions(getTrainingHints(currentTrainingSession));
    drillForm.classList.remove("is-disabled");
    document.querySelector("#drill-input").disabled = false;
    updateDrillProgress();
  } catch (error) {
    appendDrill("ai", `系统提示：${error.message}。没有启用旧版预设回复。`);
    drillProgress.textContent = "训练服务暂时不可用";
  }
}

async function sendDrill(text) {
  if (!currentDrill || !text.trim()) return;
  appendDrill("me", text.trim());
  if (currentTrainingSession) {
    if (/请.{0,8}(尊重|不要|别)|我(会|想|决定|安排).{0,12}(自己|以后|再说)|不想.{0,8}(讨论|回答)/.test(text)) {
      boundaryWins += 1;
    }
    drillForm.classList.add("is-disabled");
    document.querySelector("#drill-input").disabled = true;
    drillProgress.textContent = "对方正在回应…";
    try {
      const data = await sendClassicTrainingTurn(currentTrainingSession.sessionId, text.trim());
      currentTrainingSession = {
        ...currentTrainingSession,
        turn: data.current_turn,
        maxTurns: data.max_turns,
        achievedGoalIds: data.state?.resolved_goal_ids || currentTrainingSession.achievedGoalIds,
        finished: data.end_session,
      };
      appendDrill("ai", data.opponent_message);
      if (boundaryWins >= 2 && currentDrill?.role && currentDrill.title.includes("家庭")) {
        document.querySelector(".family-dinner-stage")?.classList.add("is-softened");
      }
      updateDrillProgress();
      if (data.end_session) {
        renderSuggestions([]);
        drillProgress.textContent = "正在生成练习复盘…";
        const review = await finishClassicTrainingSession(currentTrainingSession.sessionId);
        currentTrainingSession = null;
        renderClassicTrainingReview(review);
        return;
      }
      renderSuggestions(getTrainingHints(currentTrainingSession));
      drillForm.classList.remove("is-disabled");
      document.querySelector("#drill-input").disabled = false;
      document.querySelector("#drill-input").focus();
    } catch (error) {
      appendDrill("ai", `系统提示：${error.message}`);
      drillProgress.textContent = "发送失败，请稍后重试";
      drillForm.classList.remove("is-disabled");
      document.querySelector("#drill-input").disabled = false;
    }
    return;
  }
  const reply = currentDrill.replies[Math.min(drillStep, currentDrill.replies.length - 1)];
  drillStep += 1;
  window.setTimeout(() => {
    appendDrill("ai", reply);
    if (drillStep >= currentDrill.replies.length) renderSuggestions([COPY.endSuggest]);
  }, 420);
}

async function finishClassicTraining() {
  if (!currentTrainingSession?.sessionId) return;
  drillForm.classList.add("is-disabled");
  drillProgress.textContent = "正在生成练习复盘…";
  try {
    const review = await finishClassicTrainingSession(currentTrainingSession.sessionId);
    currentTrainingSession = null;
    renderClassicTrainingReview(review);
  } catch (error) {
    appendDrill("ai", `复盘生成失败：${error.message}`);
    drillForm.classList.remove("is-disabled");
  }
}

async function showClassicTrainingHint() {
  if (!currentTrainingSession?.sessionId) return;
  drillProgress.textContent = "正在整理这一轮提示…";
  try {
    const hint = await getClassicTrainingHint(currentTrainingSession.sessionId);
    const lines = [hint.sentence_starter, hint.communication_move, ...(hint.facts_to_use || []).slice(0, 1)].filter(Boolean);
    renderSuggestions(lines);
    drillProgress.textContent = "提示不会占用训练轮数";
  } catch (error) {
    showToast(`提示生成失败：${error.message}`);
    updateDrillProgress();
  }
}

document.addEventListener("click", async (event) => {
  const voiceTab = event.target.closest("[data-voice]");
  if (voiceTab) {
    renderKnowledgeVoice(voiceTab.dataset.voice);
    return;
  }

  if (event.target.closest("#drill-hint")) {
    await showClassicTrainingHint();
    return;
  }

  const suggest = event.target.closest("[data-suggest]");
  if (suggest) {
    if (suggest.dataset.suggest === COPY.endSuggest) {
      showToast(COPY.toastEndDrill);
      showScreen("analysis");
      return;
    }
    await sendDrill(suggest.dataset.suggest);
    return;
  }

  const difficulty = event.target.closest("[data-classic-difficulty]");
  if (difficulty) {
    selectedClassicDifficulty = Number(difficulty.dataset.classicDifficulty) || 1;
    document.querySelectorAll("[data-classic-difficulty]").forEach((button) => {
      button.classList.toggle("active", button === difficulty);
    });
    return;
  }

  const mapNode = event.target.closest("[data-map]");
  if (mapNode) {
    if (mapNode.classList.contains("locked")) {
      showToast(COPY.toastLocked);
      return;
    }
    renderMapDetail(mapNode.dataset.map);
    return;
  }

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    document.querySelectorAll("#practice-filters .chip").forEach((chip) => chip.classList.toggle("active", chip === filter));
    const map = { all: "work", work: "work", home: "home", love: "net", friend: "net" }[filter.dataset.filter];
    if (map) renderMapDetail(map);
    return;
  }

  const transcriptModeTab = event.target.closest("[data-transcript-mode]");
  if (transcriptModeTab) {
    transcriptMode = transcriptModeTab.dataset.transcriptMode === "original" ? "original" : "draft";
    renderTranscriptTurns();
    return;
  }

  const contextChip = event.target.closest("[data-context-value]");
  if (contextChip) {
    const group = contextChip.closest("[data-context-group]")?.dataset.contextGroup;
    if (group) setContextChip(group, contextChip.dataset.contextValue);
    return;
  }

  const control = event.target.closest("[data-action]");
  if (!control) return;
  switch (control.dataset.action) {
    case "record":
      prepareRecordingSession();
      await startRecording();
      break;
    case "toggle-recording":
      if (["recording", "paused"].includes(recordingState)) {
        stopRecording();
      } else if (recordingState !== "processing") {
        prepareRecordingSession();
        await startRecording();
      }
      break;
    case "history-list":
      showScreen("history");
      break;
    case "review-transcript":
      if (recordingState !== "stopped") {
        showToast(COPY.toastRecordingRequired);
        break;
      }
      ensureTranscriptReady();
      renderSpeechTranscript();
      recordingReviewSheet.hidden = true;
      showScreen("transcript");
      break;
    case "review-recording":
      loadRecordingForReview(control.dataset.recordingId);
      break;
    case "add-turn":
      addTranscriptTurn();
      break;
    case "delete-turn":
      deleteTranscriptTurn(control.dataset.turnId);
      break;
    case "set-turn-speaker":
      updateTurn(control.dataset.turnId, { speaker: control.dataset.speaker });
      break;
    case "open-context":
      if (recordingState !== "stopped") {
        showToast(COPY.toastRecordingRequired);
        break;
      }
      openContextScreen();
      break;
    case "toggle-humor":
      analysisHumor = !analysisHumor;
      humorToggle?.classList.toggle("is-on", analysisHumor);
      humorToggle?.setAttribute("aria-pressed", String(analysisHumor));
      break;
    case "retranscribe":
      if (!recordedAudioBlob) {
        showToast(COPY.toastTranscribeNoAudio);
        break;
      }
      transcriptEditedByUser = false;
      await transcribeAndFill(recordedAudioBlob, { force: true });
      break;
    case "start-recording":
      await startRecording();
      break;
    case "pause-recording":
      pauseRecording();
      break;
    case "resume-recording":
      resumeRecording();
      break;
    case "stop-recording":
      stopRecording();
      break;
    case "home":
    case "tab-home":
      showScreen("home");
      break;
    case "transcript":
      showScreen("transcript");
      break;
    case "context":
      showScreen("context");
      break;
    case "tab-practice":
    case "practice":
      showScreen("practice");
      break;
    case "tab-vent":
      showScreen("vent");
      break;
    case "tab-settings":
    case "settings":
      showSettingsHome();
      break;
    case "save-current":
      addRecording({ id: "mentor-plan", title: COPY.savedTitle, meta: COPY.savedMeta });
      showToast(COPY.toastSaved);
      showScreen("history");
      break;
    case "save-recording":
      saveCurrentRecording({ navigateToHistory: true });
      break;
    case "analyze":
      {
        if (recordingState !== "stopped") {
          showToast(COPY.toastRecordingRequired);
          break;
        }
        const transcript = getTranscriptText();
        if (isTranscriptPlaceholder(transcript)) {
          showToast(transcribing ? COPY.toastTranscribing : "请先确认转写内容");
          break;
        }
        recordingReviewSheet.hidden = true;
        await runKnowledgeAnalysis(transcript);
      }
      break;
    case "mark":
      control.textContent = `${COPY.marked} ${formatTimer(elapsed)}`;
      showToast(COPY.toastMarked);
      break;
    case "replay":
      showToast(COPY.toastReplay);
      openLevels("work");
      break;
    case "save-personal-scene": {
      const role = document.querySelector("#context-relationship")?.value.trim() || "对方";
      const sceneTitle = currentKnowledgeAnalysis?.scene?.title || "我的专属场景";
      const sceneText = [sceneTitle, getTranscriptText(), collectAnalysisContext()].filter(Boolean).join("\n");
      document.querySelector("#custom-role").value = role;
      document.querySelector("#custom-scene").value = sceneText;
      showToast("已纳入用户专属场景");
      showScreen("custom");
      break;
    }
    case "open-levels":
      openLevels(control.dataset.scene || selectedMap);
      break;
    case "custom-scene":
      showScreen("custom");
      break;
    case "start-drill":
      await startDrill(control.dataset.drill);
      break;
    case "end-drill":
      if (currentTrainingSession?.sessionId) await finishClassicTraining();
      else showScreen("practice");
      break;
    case "levels":
      showScreen(drillOrigin === "custom" ? "custom" : "levels");
      break;
    case "settings-item":
      openSettingsDetail(control.dataset.item);
      break;
    case "settings-export-preview":
      previewSettingsExport();
      break;
    case "settings-bluetooth-scan":
      showToast(COPY.toastBluetoothPending);
      break;
    case "settings-reset":
      await resetSettings();
      break;
    case "clear-vent-identity":
      clearVentIdentity();
      break;
  }
});

document.querySelector("#custom-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const role = document.querySelector("#custom-role").value.trim() || COPY.opponent;
  const scene = document.querySelector("#custom-scene").value.trim() || COPY.customOpener;
  showToast(COPY.toastCustom);
  await startDrill("custom", { role, title: COPY.customTitle, opener: scene, origin: "custom" });
});

document.querySelector("#drill-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#drill-input");
  await sendDrill(input.value);
  input.value = "";
});

document.querySelectorAll("[data-settings-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSettings(collectSettingsForm(form));
  });
});

document.addEventListener("input", (event) => {
  const turnField = event.target.closest("[data-turn-field]");
  if (turnField) {
    if (transcriptMode === "original") return;
    const turn = findTurn(turnField.dataset.turnId);
    if (!turn) return;
    turn[turnField.dataset.turnField] = turnField.value;
    syncTranscriptFromTurns();
    if (turnField.dataset.turnField !== "speaker") return;
    const card = turnField.closest(".transcript-turn");
    const avatar = card?.querySelector(".turn-avatar");
    if (avatar) avatar.textContent = (turnField.value || "我").slice(0, 1);
    card?.querySelectorAll("[data-action='set-turn-speaker']").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.speaker === turnField.value.trim());
    });
    return;
  }

  const contextField = event.target.closest("#context-relationship, #context-occasion, #context-feeling, #context-goal");
  if (!contextField) return;
  const group = contextField.id.replace("context-", "");
  document.querySelectorAll(`[data-context-group="${group}"] .chip`).forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.contextValue === contextField.value.trim());
  });
});

installPhoneViewportFitting();
prepareRecordingSession();
renderRecordings();
renderMapDetail("work");
renderSettings();
renderVentIdentity();
loadSettings({ silent: true });
