import { installPhoneViewportFitting } from "./responsive.js";
import { analyzeConfirmedTranscript, loadKnowledgeBase } from "./knowledge-analysis.js";
import { classicTraining } from "./classic-api-client.js";
import { WavRecorder } from "./audio-recorder.js";

const I18N = {
  "title": "\u9519\u4e0d\u8d77\u6211\u5bf9\u4e86",
  "guide-kicker": "\u9519\u4e0d\u8d77\u6211\u5bf9\u4e86 \u00b7 \u6a21\u62df\u5668",
  "guide-title": "\u628a\u6ca1\u8bf4\u5b8c\u7684\u8bdd\uff0c<br>\u91cd\u65b0\u62ff\u56de\u6765\u3002",
  "guide-copy": "\u5f55\u97f3\u590d\u76d8\u3001\u7ecf\u5178\u5bf9\u7ec3\u3001\u66b4\u51fb\u53d1\u6cc4\u4e0e\u8bbe\u7f6e\u7684\u5b8c\u6574\u53ef\u70b9\u51fb\u6d41\u7a0b\u3002",
  "guide-home": "\u9996\u9875\u4e0e\u5f85\u5206\u6790\u5f55\u97f3",
  "guide-practice": "\u7ecf\u5178\u5bf9\u7ec3\u4e0e\u573a\u666f\u5730\u56fe",
  "guide-vent": "\u60c5\u7eea\u66b4\u51fb",
  "guide-settings": "\u8bbe\u7f6e",
  "guide-note": "\u672c\u6a21\u62df\u5668\u4f7f\u7528\u6f14\u793a\u6570\u636e\uff0c\u4e0d\u4f1a\u8c03\u7528\u9ea6\u514b\u98ce\u6216\u4e0a\u4f20\u771f\u5b9e\u5f55\u97f3\u3002",
  "phone-label": "\u9519\u4e0d\u8d77\u6211\u5bf9\u4e86 \u79fb\u52a8\u7aef\u6a21\u62df\u5668",
  "app-name": "\u9519\u4e0d\u8d77\u6211\u5bf9\u4e86",
  "app-tagline": "\u8868\u8fbe\u4e0e\u60c5\u7eea\u8bad\u7ec3\u52a9\u624b",
  "home-bubble": "\u68c0\u6d4b\u5230\u4f60\u4eca\u5929\u6709\u53d1\u751f\u4e00\u6b21\u77db\u76fe\uff0c\u8981\u4e0d\u8981\u6f14\u7ec3\u4e00\u4e0b\uff1f",
  "record-cta": "\u6309\u4f4f\u8bb0\u5f55\u4eca\u5929\u7684\u51b2\u7a81",
  "current-title": "\u4eca\u5929 14:20 \u00b7 \u548c\u5bfc\u5e08\u8ba8\u8bba\u65b9\u6848",
  "save-first": "\u5148\u8bb0\u4e0b\u6765",
  "analyze": "\u5206\u6790\u4e00\u4e0b",
  "saved-title": "\u5f85\u5206\u6790\u7684\u5f55\u97f3",
  "saved-note": "\u5df2\u5b58\u5165\u540e\u7aef\uff0c\u53ef\u968f\u65f6\u56de\u6765\u7ee7\u7eed\u5206\u6790",
  "back": "\u8fd4\u56de\u9996\u9875",
  "recording": "\u6b63\u5728\u8bb0\u5f55",
  "live-note": "\u5f55\u97f3\u7ed3\u675f\u540e\uff0c\u8bf7\u5728\u4e0b\u65b9\u786e\u8ba4\u8bf4\u8bdd\u4eba\u548c\u6587\u5b57",
  "marked-initial": "\uff0b \u5df2\u6807\u8bb0\u7d27\u5f20\u70b9 02:16",
  "transcript": "\u5b9e\u65f6\u8f6c\u5199",
  "analyzing": "AI \u5b9e\u65f6\u5206\u6790\u4e2d\u2026",
  "mentor-time": "\u5bfc\u5e08 \u00b7 02:08",
  "mentor-line": "\u8fd9\u4e2a\u683c\u5f0f\u6211\u4e0d\u662f\u8bf4\u8fc7\u4e86\u5417\uff1f\u4f60\u5230\u5e95\u6709\u6ca1\u6709\u8ba4\u771f\u505a\uff1f",
  "me-time": "\u6211 \u00b7 02:16",
  "me-line": "\u6211\u6539\u8fc7\u4e86\uff0c\u4f46\u662f\u8fd9\u6b21\u6a21\u677f\u548c\u4e0a\u6b21\u4e0d\u4e00\u6837\u2026\u2026",
  "after-record": "\u7ed3\u675f\u5f55\u97f3\u540e",
  "save-recording": "\u5b58\u50a8\u540e\u518d\u5206\u6790",
  "direct-analyze": "\u76f4\u63a5\u5206\u6790",
  "privacy": "\ud83d\udd12 \u5b58\u50a8\u540e\u4f1a\u51fa\u73b0\u5728\u9996\u9875\u4e0b\u65b9\uff1b\u53ea\u6709\u4e3b\u52a8\u70b9\u51fb\u65f6\u624d\u5f00\u59cb\u77e5\u8bc6\u5e93\u5206\u6790\u3002",
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
  "custom-kicker": "\u6574\u7406\u771f\u5b9e\u7ecf\u5386",
  "custom-title": "\u628a\u5f53\u65f6\u7684\u5bf9\u8bdd\u8bb2\u4e0b\u6765",
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
  "seedMeta": "\u6628\u5929 19:32 \u00b7 02:08 \u00b7 \u5df2\u5b58\u50a8",
  "analyzeNow": "\u7acb\u5373\u5206\u6790",
  "savedTitle": "\u5bfc\u5e08\u529e\u516c\u5ba4 \u00b7 \u65b9\u6848\u4fee\u6539",
  "savedMeta": "\u4eca\u5929 14:20 \u00b7 03:42 \u00b7 \u5df2\u5b58\u50a8",
  "toastSaved": "\u5f55\u97f3\u5df2\u5b58\u50a8\uff0c\u53ef\u968f\u65f6\u56de\u6765\u5206\u6790",
  "liveTitle": "\u521a\u521a\u7684\u51b2\u7a81 \u00b7 \u5b9e\u65f6\u5f55\u97f3",
  "justNow": "\u521a\u521a",
  "stored": "\u5df2\u5b58\u50a8",
  "toastLiveSaved": "\u5df2\u5b58\u50a8\u5230\u5f85\u5206\u6790\u5f55\u97f3",
  "marked": "\u2713 \u5df2\u6807\u8bb0\u7d27\u5f20\u70b9",
  "toastMarked": "\u7d27\u5f20\u65f6\u523b\u5df2\u6807\u8bb0",
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
  }
};

const MAP_NODES = {
  "home": {
    "kicker": "\u5bb6 \u00b7 4\u4e2a\u8bad\u7ec3\u573a\u666f",
    "title": "\u4eb2\u621a\u50ac\u5a5a\u600e\u4e48\u63a5",
    "scene": "home",
    "icon": "/assets/map-icon-house.svg"
  },
  "work": {
    "kicker": "\u516c\u53f8 \u00b7 7\u4e2a\u8bad\u7ec3\u573a\u666f",
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
const confirmedTranscript = document.querySelector("#confirmed-transcript");
const analysisScreen = document.querySelector(".analysis-screen");

const STORAGE_KEY = "on-cue-demo-recordings";
const DEFAULT_TRANSCRIPT = `${I18N["mentor-line"] ? `导师：${I18N["mentor-line"]}` : ""}\n我：${I18N["me-line"]}`;
const seedRecordings = [{ id: "family-dinner", title: COPY.seedTitle, meta: COPY.seedMeta, transcript: DEFAULT_TRANSCRIPT }];
const TAB_ORDER = { home: 0, recording: 0, analysis: 0, practice: 1, levels: 1, custom: 1, drill: 1, review: 1, vent: 2, settings: 3 };
const BACK_OF = { recording: "home", analysis: "home", levels: "practice", custom: "practice", drill: "levels", review: "practice" };

let recordings = loadRecordings();
let elapsed = 0;
let timerId = null;
let toastId = null;
let currentScreen = "home";
let selectedMap = "work";
let drillOrigin = "levels";
let currentDrill = null;
let currentTrainingSession = null;
let drillStep = 0;
let boundaryWins = 0;
let knowledgePromise = null;
let currentKnowledgeAnalysis = null;
let selectedKnowledgeVoice = "A";
let classicScenarios = [];
let currentIncident = null;
const wavRecorder = new WavRecorder();
let activeRecordButton = null;

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

function waveform() {
  const heights = [12, 24, 18, 33, 27, 16, 30, 14, 21, 10, 26, 18, 31, 16];
  return heights
    .map((height, index) => `<i class="${[3, 4, 10].includes(index) ? "hot" : ""}" style="--h:${height}px"></i>`)
    .join("");
}

function renderRecordings() {
  savedList.innerHTML = recordings
    .map(
      (recording) => `
        <article class="saved-card">
          <strong>${recording.title}</strong>
          <div class="meta">${recording.meta}</div>
          <div class="saved-bottom">
            <div class="mini-wave" aria-hidden="true">${waveform()}</div>
            <button class="figma-button primary" data-action="analyze" data-recording-id="${recording.id}">${COPY.analyzeNow}</button>
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

function startTimer() {
  clearInterval(timerId);
  elapsed = 138;
  timerElement.textContent = "02:18";
  timerId = setInterval(() => {
    elapsed += 1;
    timerElement.textContent = formatTimer(elapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function showToast(message) {
  clearTimeout(toastId);
  toast.textContent = message;
  toast.classList.add("show");
  toastId = setTimeout(() => toast.classList.remove("show"), 2200);
}

function inferDirection(from, to) {
  if (BACK_OF[from] === to) return "back";
  if (BACK_OF[to] === from) return "forward";
  const a = TAB_ORDER[from] ?? 0;
  const b = TAB_ORDER[to] ?? 0;
  if (b === a) return "forward";
  return b > a ? "forward" : "back";
}

function revealInbox(behavior = "smooth") {
  const inbox = document.querySelector("#home-inbox");
  if (!inbox) return;
  requestAnimationFrame(() => {
    const firstSaved = inbox.querySelector(".saved-card");
    inbox.scrollTo({ top: firstSaved ? firstSaved.offsetTop - 12 : 0, behavior });
  });
}

function showScreen(id, { scrollInbox = false, direction } = {}) {
  const next = screens.find((screen) => screen.dataset.screen === id);
  if (!next) return;
  const prev = screens.find((screen) => screen.classList.contains("active"));
  const dir = direction || inferDirection(currentScreen, id);

  screens.forEach((screen) => {
    screen.classList.remove("enter-from-left", "enter-from-right", "leaving-left", "leaving-right", "splash-out");
  });

  if (prev && prev !== next) {
    prev.classList.add(dir === "back" ? "leaving-right" : "leaving-left");
    prev.classList.remove("active");
    window.setTimeout(() => {
      prev.classList.remove("leaving-left", "leaving-right", "splash-out");
    }, 300);
  }

  if (dir === "back") next.classList.add("enter-from-left");
  else next.classList.add("enter-from-right");
  next.offsetHeight;
  next.classList.add("active");
  next.classList.remove("enter-from-left", "enter-from-right");
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
  if (id === "recording") startTimer();
  else stopTimer();
  if (id === "home" && scrollInbox) revealInbox();
}

function connectMouseGame() {
  mouseGameFrame?.contentWindow?.addEventListener("tumbler:event", (event) => {
    if (event.detail?.type !== "CLOSE_REQUESTED") return;
    showScreen("practice");
    window.setTimeout(() => {
      mouseGameFrame.src = "/mouse-game.html";
    }, 0);
  });
}

mouseGameFrame?.addEventListener("load", connectMouseGame);

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
    `${confidenceLabel} · ${result.sourceStats.scenes} 场景${riskLabel}`,
  );
  setKnowledgeText("#kb-match-title", `匹配场景：${result.scene.title}`);
  setKnowledgeText("#kb-scene-opening", result.sceneRead.opening);
  setKnowledgeText("#kb-key-detail", result.sceneRead.key_detail);
  setKnowledgeText("#kb-stuck", result.sceneRead.where_it_is_stuck);
  setKnowledgeText("#kb-confirm", result.sceneRead.need_to_confirm);
  setKnowledgeText("#kb-uncertainty", `不确定性说明：${result.uncertainty}`);

  const evidence = document.querySelector("#kb-evidence");
  evidence.replaceChildren(
    ...result.evidence.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    }),
  );

  const tags = document.querySelector("#kb-tags");
  const items = [
    ...result.patterns.map((item) => `模式：${item.name}`),
    ...result.strategies.map((item) => `策略：${item.name}`),
  ];
  tags.replaceChildren(
    ...items.slice(0, 6).map((item) => {
      const tag = document.createElement("span");
      tag.textContent = item;
      return tag;
    }),
  );
  renderKnowledgeVoice(result.primaryVoice);
}

async function runKnowledgeAnalysis(transcript) {
  const text = String(transcript || "").trim();
  if (!text) {
    showToast("请先确认逐字稿内容");
    return;
  }
  showScreen("analysis");
  analysisScreen.classList.add("is-loading");
  setKnowledgeText("#kb-status", "正在检索 120 个场景…");
  try {
    const knowledge = await knowledgeBase();
    renderKnowledgeAnalysis(analyzeConfirmedTranscript(text, knowledge));
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

async function ensureClassicScenarios() {
  if (classicScenarios.length) return classicScenarios;
  classicScenarios = (await classicTraining.scenarios()).filter((item) => item.training_mode === "pua_response");
  return classicScenarios;
}

async function openLevels(scene) {
  const pack = LEVELS[scene] || LEVELS.work;
  levelsList.innerHTML = '<p class="loading-copy">正在读取 PUA 训练模块…</p>';
  showScreen("levels");
  let items = [];
  try {
    const scenarios = await ensureClassicScenarios();
    items = scenarios
      .filter((item) => (item.scenario_id.includes("family") ? "home" : "work") === scene)
      .map((item) => ({ id: item.scenario_id, title: item.title, copy: item.short_description }));
  } catch (error) {
    levelsList.innerHTML = `<p class="loading-copy">场景读取失败：${error.message}</p>`;
    return;
  }
  document.querySelector("#levels-kicker").textContent = pack.kicker;
  document.querySelector("#levels-title").textContent = "PUA 应对训练";
  const renderCards = (entries) => entries
    .map((item) => `
        <button class="level-card" data-action="start-drill" data-drill="${item.id}">
          <b>${item.title}</b>
          <span>${item.copy}</span>
        </button>
      `)
    .join("");

  if (scene === "work") {
    const generalItems = items.filter((item) => item.id === "pua-workplace-general");
    const womenItems = items.filter((item) => item.id !== "pua-workplace-general");
    levelsList.innerHTML = `
      <section class="level-section" aria-labelledby="general-workplace-pua-title">
        <div class="level-section-heading">
          <small>所有职场人都可能遇到</small>
          <h2 id="general-workplace-pua-title">通用职场 PUA</h2>
        </div>
        ${renderCards(generalItems)}
      </section>
      <section class="level-section" aria-labelledby="women-workplace-pua-title">
        <div class="level-section-heading">
          <small>性别、婚育与晋升偏见</small>
          <h2 id="women-workplace-pua-title">女性职场 PUA</h2>
        </div>
        ${renderCards(womenItems)}
      </section>
    `;
    return;
  }

  levelsList.innerHTML = renderCards(items);
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
  if (!drillSuggestions) return;
  drillSuggestions.innerHTML = list.map((line) => `<button type="button" data-suggest="${line}">${line}</button>`).join("");
}

function updateDrillProgress() {
  if (!currentTrainingSession) {
    drillProgress.textContent = "";
    return;
  }
  drillProgress.textContent = `PUA 模型训练 · 第 ${Math.min(currentTrainingSession.current_turn + 1, currentTrainingSession.max_turns)} / ${currentTrainingSession.max_turns} 轮`;
}

function renderTrainingReview(review) {
  const target = document.querySelector("#training-review");
  target.replaceChildren();
  const section = document.createElement("section");
  section.className = "review-summary-card";
  section.innerHTML = `<p>${escapeHtml(review.summary)}</p>`;
  const columns = document.createElement("div");
  columns.className = "review-columns";
  columns.innerHTML = `<article><strong>做得好的地方</strong><ul>${review.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article><article><strong>优先改进</strong><ul>${review.priority_improvements.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article>`;
  const dimensions = document.createElement("div");
  dimensions.className = "review-dimensions";
  review.dimensions.forEach((item) => {
    const card = document.createElement("article");
    card.innerHTML = `<header><strong>${escapeHtml(item.name)}</strong><span>${item.score === null ? "证据不足" : `${item.score}/5`}</span></header><small>对话证据：${escapeHtml(item.evidence)}</small><p>${escapeHtml(item.feedback)}</p>`;
    dimensions.appendChild(card);
  });
  const next = document.createElement("article");
  next.className = "review-next";
  next.innerHTML = `<strong>换一种更清楚的说法</strong><p>${escapeHtml(review.better_response)}</p><strong>下一次只练这一点</strong><p>${escapeHtml(review.next_practice)}</p><button class="figma-button primary" data-action="practice">返回训练地图</button>`;
  target.append(section, columns, dimensions, next);
  showScreen("review");
}

async function startDrill(id, extra = {}) {
  const scenario = extra.scenario || (await ensureClassicScenarios()).find((item) => item.scenario_id === id);
  if (!scenario) throw new Error("没有找到这个 PUA 场景");
  const isFamily = id.includes("family");
  const familyRoles = {
    "pua-family-marriage": "姑妈",
    "pua-family-prying": "亲戚",
    "pua-family-son-preference": "家人",
    "pua-family-emotion-dumping": "家人",
  };
  const role = extra.role || familyRoles[id] || scenario.briefing.counterpart;
  currentDrill = { role, title: scenario.title, scenario };
  drillOrigin = extra.origin || "levels";
  drillStep = 0;
  boundaryWins = 0;
  document.querySelector(".family-dinner-stage")?.classList.remove("is-softened");
  const drillScreen = document.querySelector(".drill-screen");
  drillScreen?.classList.toggle("scene-family", isFamily);
  drillScreen?.classList.toggle("scene-workplace", !isFamily);
  const useBossTwo = /general|overtime|emotional-pressure|gender/.test(id);
  drillScreen?.classList.toggle("use-boss-two", useBossTwo);
  document.querySelector("#drill-role").textContent = currentDrill.role;
  document.querySelector("#drill-title").textContent = extra.title || scenario.title;
  drillThread.innerHTML = "";
  renderSuggestions([]);
  drillForm.classList.remove("is-disabled");
  showScreen("drill");
  appendDrill("ai", "正在生成这个关卡的开场……");
  try {
    const data = extra.session || await classicTraining.start(id, scenario.default_difficulty);
    currentTrainingSession = data;
    drillThread.innerHTML = "";
    appendDrill("ai", data.opponent_message);
    renderSuggestions((data.response_framework || []).slice(0, 3));
    document.querySelector("#drill-input").disabled = false;
    updateDrillProgress();
  } catch (error) {
    currentTrainingSession = null;
    drillThread.innerHTML = "";
    appendDrill("ai", `训练启动失败：${error.message}`);
    drillForm.classList.add("is-disabled");
  }
}

async function finishTraining() {
  if (!currentTrainingSession?.session_id) return;
  drillForm.classList.add("is-disabled");
  try {
    const review = await classicTraining.finish(currentTrainingSession.session_id);
    currentTrainingSession = null;
    renderTrainingReview(review);
  } catch (error) {
    appendDrill("ai", `复盘生成失败：${error.message}`);
    drillForm.classList.remove("is-disabled");
  }
}

async function sendDrill(text) {
  if (!currentTrainingSession || !text.trim()) return;
  appendDrill("me", text.trim());
  const isBoundaryReply = /请.{0,8}(尊重|不要|别)|我(会|想|决定|安排).{0,12}(自己|以后|再说)|这(是|件事).{0,8}(我|我们).{0,8}(决定|安排)|不想.{0,8}(讨论|回答)/.test(text);
  if (isBoundaryReply) boundaryWins += 1;
  drillForm.classList.add("is-disabled");
  try {
    const result = await classicTraining.turn(currentTrainingSession.session_id, text.trim());
    currentTrainingSession.current_turn = result.current_turn;
    updateDrillProgress();
    appendDrill("ai", result.opponent_message);
    if (boundaryWins >= 2 && currentDrill?.role === "姑妈") {
      document.querySelector(".family-dinner-stage")?.classList.add("is-softened");
      appendDrill("ai", "……那你们年轻人自己想怎么过就怎么过吧。");
      boundaryWins = -999;
    }
    if (result.end_session) await finishTraining();
    else drillForm.classList.remove("is-disabled");
  } catch (error) {
    appendDrill("ai", `发送失败：${error.message}`);
    drillForm.classList.remove("is-disabled");
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function incidentSegments(incident) {
  if (incident.dialogue_segments?.length) return incident.dialogue_segments;
  const counterpart = incident.draft.counterpart_identity || "对方";
  const segments = incident.draft.counterpart_words_or_actions.map((content, index) => ({
    segment_id: `counterpart-${index + 1}`,
    speaker_id: "counterpart",
    speaker_label: counterpart,
    content,
    confidence: "high",
  }));
  if (incident.draft.user_words_or_actions) segments.push({
    segment_id: "user-1", speaker_id: "user", speaker_label: "我",
    content: incident.draft.user_words_or_actions, confidence: "high",
  });
  return segments;
}

function advisorMarkup(feedback) {
  if (!feedback) return "";
  return `
    <section class="advisor-output">
      <h3>我听下来的现场</h3>
      <p>${escapeHtml(feedback.scene_read.opening)}</p>
      <details><summary>含糊点与判断依据</summary>
        <p>${escapeHtml(feedback.ambiguity_analysis.primary_interpretation.statement)}</p>
        <p><b>验证一句话：</b>${escapeHtml(feedback.ambiguity_analysis.verification_move)}</p>
      </details>
      <div class="advisor-voices">
        ${feedback.voice_order.map((id) => {
          const voice = feedback.voice_versions[id];
          return `<article><b>${id}${id === feedback.primary_voice ? " · 首选" : ""}</b><h4>${escapeHtml(voice.headline)}</h4><p>${escapeHtml(voice.analysis)}</p><blockquote>${escapeHtml(voice.direct_reply)}</blockquote><ol>${voice.next_steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></article>`;
        }).join("")}
      </div>
    </section>`;
}

function renderIncident(incident) {
  currentIncident = incident;
  const workspace = document.querySelector("#incident-workspace");
  workspace.hidden = false;
  const messages = incident.messages.map((message) => `<div class="incident-message ${message.speaker}">${escapeHtml(message.content)}</div>`).join("");
  let next = "";
  if (incident.status === "clarifying") {
    next = `<form id="incident-answer-form"><textarea id="incident-answer" rows="3" maxlength="2500" placeholder="按真实情况回答就好……" required></textarea><div class="inline-actions"><button class="voice-button" type="button" data-record-target="incident-answer" data-purpose="incident_narration" data-limit="180">● 语音补充</button><button class="figma-button primary" type="submit">补充这条信息</button></div></form>`;
  } else if (incident.status === "safety_redirect") {
    next = `<div class="safety-card"><b>请优先处理现实安全</b><p>${escapeHtml(incident.safety_message)}</p></div>`;
  } else {
    const draft = incident.draft;
    const segments = incidentSegments(incident);
    next = `
      <section class="scene-confirm-card">
        <h3>${escapeHtml(draft.title || "我的真实场景")}</h3>
        <p>${escapeHtml(draft.situation_summary)}</p>
        <dl><div><dt>对话对象</dt><dd>${escapeHtml(draft.counterpart_identity)}</dd></div><div><dt>我卡在哪里</dt><dd>${escapeHtml(draft.stuck_point)}</dd></div><div><dt>下一次想做到</dt><dd>${escapeHtml(draft.desired_outcome)}</dd></div></dl>
        ${incident.status === "ready" ? '<button class="figma-button primary" data-incident-action="confirm">确认场景卡</button>' : '<span class="confirmed-badge">场景已确认</span>'}
      </section>
      <section class="speaker-editor">
        <h3>确认说话人和逐句稿</h3>
        <p>修改后再生成三种反馈。</p>
        ${segments.map((segment) => `<div class="speaker-row" data-segment-id="${escapeHtml(segment.segment_id)}"><select><option value="counterpart" ${segment.speaker_id === "counterpart" ? "selected" : ""}>对方</option><option value="user" ${segment.speaker_id === "user" ? "selected" : ""}>我</option><option value="other" ${segment.speaker_id === "other" ? "selected" : ""}>其他人</option></select><input class="speaker-label" maxlength="40" value="${escapeHtml(segment.speaker_label)}"><textarea rows="2" maxlength="1200">${escapeHtml(segment.content)}</textarea></div>`).join("")}
        <button class="figma-button primary" data-incident-action="advise">确认逐句稿并生成 A / B / C</button>
      </section>
      ${advisorMarkup(incident.advisor_feedback)}
      ${incident.status === "confirmed" ? '<button class="figma-button primary incident-train" data-incident-action="train">把这段经历变成五轮训练</button>' : ""}`;
  }
  workspace.innerHTML = `<div class="incident-understanding"><b>目前我理解的是</b><p>${escapeHtml(incident.acknowledgement)}</p></div><div class="incident-messages">${messages}</div>${next}`;
  workspace.scrollTop = workspace.scrollHeight;
}

function collectSpeakerSegments() {
  return [...document.querySelectorAll(".speaker-row")].map((row) => ({
    segment_id: row.dataset.segmentId,
    speaker_id: row.querySelector("select").value,
    speaker_label: row.querySelector(".speaker-label").value.trim(),
    content: row.querySelector("textarea").value.trim(),
    confidence: "high",
  })).filter((item) => item.speaker_label && item.content);
}

async function runIncidentAction(action) {
  if (!currentIncident) return;
  const status = document.querySelector("#incident-status");
  try {
    if (action === "confirm") {
      status.textContent = "正在确认场景卡……";
      renderIncident(await classicTraining.confirmIncident(currentIncident.incident_id));
    } else if (action === "advise") {
      const segments = collectSpeakerSegments();
      if (!segments.some((item) => item.speaker_id === "user") || !segments.some((item) => item.speaker_id === "counterpart")) {
        throw new Error("逐句稿至少要有一句“我”和一句“对方”");
      }
      status.textContent = "正在生成 A / B / C 三种反馈……";
      const feedback = await classicTraining.adviseIncident(currentIncident.incident_id, segments);
      currentIncident = { ...currentIncident, dialogue_segments: segments, advisor_feedback: feedback };
      renderIncident(currentIncident);
    } else if (action === "train") {
      status.textContent = "正在生成专属训练……";
      const result = await classicTraining.trainIncident(currentIncident.incident_id);
      await startDrill(result.scenario.scenario_id, { session: result.session, scenario: result.scenario, role: result.role_display_name, origin: "custom" });
    }
    status.textContent = "已更新";
  } catch (error) {
    status.textContent = `操作失败：${error.message}`;
  }
}

function appendToField(field, text) {
  const separator = field.value.trim() ? "\n" : "";
  field.value = `${field.value.trimEnd()}${separator}${text}`;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.focus();
}

async function completeRecording(button, blob) {
  activeRecordButton = null;
  button.classList.remove("recording");
  button.textContent = button.dataset.purpose === "classic_turn" ? "●" : "● 语音输入";
  if (!blob) return;
  const status = button.dataset.purpose === "classic_turn" ? drillProgress : document.querySelector("#incident-status");
  status.textContent = "正在转写，请稍候……";
  try {
    const result = await classicTraining.transcribe(button.dataset.purpose, blob);
    appendToField(document.querySelector(`#${button.dataset.recordTarget}`), result.text);
    status.textContent = "转写完成，请检查文字后再发送";
  } catch (error) {
    status.textContent = `转写失败：${error.message}`;
  }
}

async function handleRecordButton(button) {
  if (activeRecordButton === button) {
    await completeRecording(button, await wavRecorder.stop());
    return;
  }
  if (activeRecordButton) return;
  const originalText = button.textContent;
  try {
    activeRecordButton = button;
    button.classList.add("recording");
    await wavRecorder.start({
      limitSeconds: Number(button.dataset.limit || 90),
      onTick: (elapsed, limit) => { button.textContent = `■ ${elapsed}/${limit}s`; },
      onLimit: (blob) => completeRecording(button, blob),
    });
  } catch (error) {
    activeRecordButton = null;
    button.classList.remove("recording");
    button.textContent = originalText;
    showToast(`无法录音：${error.message}`);
  }
}

document.addEventListener("click", async (event) => {
  const recordButton = event.target.closest("[data-record-target]");
  if (recordButton) {
    await handleRecordButton(recordButton);
    return;
  }

  const incidentAction = event.target.closest("[data-incident-action]");
  if (incidentAction) {
    await runIncidentAction(incidentAction.dataset.incidentAction);
    return;
  }

  if (event.target.closest("#drill-hint")) {
    if (!currentTrainingSession) return;
    try {
      const hint = await classicTraining.hint(currentTrainingSession.session_id);
      renderSuggestions([hint.sentence_starter, ...hint.facts_to_use].slice(0, 3));
    } catch (error) {
      showToast(`提示生成失败：${error.message}`);
    }
    return;
  }

  const voiceTab = event.target.closest("[data-voice]");
  if (voiceTab) {
    renderKnowledgeVoice(voiceTab.dataset.voice);
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

  const control = event.target.closest("[data-action]");
  if (!control) return;
  switch (control.dataset.action) {
    case "record":
      showScreen("recording");
      break;
    case "home":
    case "tab-home":
      showScreen("home");
      break;
    case "tab-practice":
    case "practice":
      showScreen("practice");
      break;
    case "tab-vent":
      showScreen("vent");
      break;
    case "tab-settings":
      showScreen("settings");
      break;
    case "save-current":
      addRecording({ id: "mentor-plan", title: COPY.savedTitle, meta: COPY.savedMeta });
      showToast(COPY.toastSaved);
      showScreen("home", { scrollInbox: true });
      break;
    case "save-recording":
      addRecording({
        id: `live-${Date.now()}`,
        title: COPY.liveTitle,
        meta: `${COPY.justNow} \u00b7 ${formatTimer(Math.max(elapsed, 18))} \u00b7 ${COPY.stored}`,
        transcript: confirmedTranscript.value.trim(),
      });
      showToast(COPY.toastLiveSaved);
      showScreen("home", { scrollInbox: true });
      break;
    case "analyze":
      {
        const saved = recordings.find((item) => item.id === control.dataset.recordingId);
        const transcript = currentScreen === "recording"
          ? confirmedTranscript.value
          : saved?.transcript || DEFAULT_TRANSCRIPT;
        await runKnowledgeAnalysis(transcript);
      }
      break;
    case "mark":
      control.textContent = `${COPY.marked} ${formatTimer(elapsed)}`;
      showToast(COPY.toastMarked);
      break;
    case "replay":
      showToast(COPY.toastReplay);
      await openLevels("work");
      break;
    case "open-levels":
      await openLevels(control.dataset.scene || selectedMap);
      break;
    case "custom-scene":
      showScreen("custom");
      break;
    case "start-drill":
      await startDrill(control.dataset.drill);
      break;
    case "end-drill":
      await finishTraining();
      break;
    case "levels":
      showScreen(drillOrigin === "custom" ? "custom" : "levels");
      break;
    case "settings-item":
      showToast(COPY.toastSettings[control.dataset.item] || COPY.toastNoop);
      break;
  }
});

document.querySelector("#custom-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const scene = document.querySelector("#custom-scene").value.trim();
  if (scene.length < 10) return;
  document.querySelector("#incident-status").textContent = "正在理解这段经历……";
  try {
    renderIncident(await classicTraining.createIncident(scene));
    document.querySelector("#incident-status").textContent = "已整理；需要时请继续补充";
  } catch (error) {
    document.querySelector("#incident-status").textContent = `整理失败：${error.message}`;
  }
});

document.querySelector("#drill-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#drill-input");
  await sendDrill(input.value);
  input.value = "";
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "incident-answer-form") return;
  event.preventDefault();
  const answer = document.querySelector("#incident-answer").value.trim();
  if (!answer || !currentIncident) return;
  document.querySelector("#incident-status").textContent = "正在补充场景信息……";
  try {
    renderIncident(await classicTraining.answerIncident(currentIncident.incident_id, answer));
    document.querySelector("#incident-status").textContent = "已补充";
  } catch (error) {
    document.querySelector("#incident-status").textContent = `补充失败：${error.message}`;
  }
});

installPhoneViewportFitting();
renderRecordings();
renderMapDetail("work");
