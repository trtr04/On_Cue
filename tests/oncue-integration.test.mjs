import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("the app starts on home with the 00 splash removed", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.doesNotMatch(html, /data-screen="splash"/);
  assert.doesNotMatch(html, /data-jump="splash"/);
  assert.match(html, /class="screen home-screen active"/);
  assert.match(script, /let currentScreen = "home"/);
  assert.doesNotMatch(script, /playSplash\(\)/);
});

test("the home layout centers one large recording action and moves history to the header", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");

  assert.match(html, /data-action="toggle-recording"/);
  assert.match(html, /class="history-button" data-action="history-list"/);
  assert.match(html, /\/assets\/mic-record-large\.svg/);
  assert.doesNotMatch(html, /今日主要任务|记录一次没说完的话/);
  assert.doesNotMatch(html, /id="home-inbox"/);
  assert.match(css, /\.home-chat-bubble\s*\{/);
  assert.match(css, /\.home-record\s*\{[^}]*width:\s*274px;[^}]*height:\s*230px;/s);
  assert.match(css, /\.recording-review-sheet\s*\{/);
});

test("transcript and analysis screens remain stacked inside the phone", async () => {
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");

  assert.match(css, /\.transcript-screen,\s*\.analysis-screen,\s*\.context-screen\s*\{\s*position:\s*absolute;/s);
});

test("phone scaling fits every viewport without cropping", async () => {
  const { computePhoneScale } = await import("../responsive.js");

  assert.equal(computePhoneScale(390, 844), 1);
  assert.equal(computePhoneScale(375, 667), 667 / 844);
  assert.equal(computePhoneScale(430, 932), 430 / 390);
  assert.equal(computePhoneScale(844, 390), 390 / 844);
});

test("the emotion game is a first-level tab with face and name import around the original play mode", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");

  assert.match(html, /<iframe[^>]+id="mouse-game-frame"[^>]+src="\/mouse-game\.html"/);
  assert.match(html, /id="vent-face-input"/);
  assert.match(html, /id="vent-name-input"/);
  assert.match(html, /data-screen="vent"[\s\S]*data-action="tab-vent"/);
  assert.match(css, /\.vent-screen\s*\{\s*background:\s*var\(--brand-soft\)/);
  assert.match(script, /tumbler:identity/);
  assert.doesNotMatch(html, /id="vent-stage"|id="vent-total"|honey-badger-game\.svg/);
  assert.doesNotMatch(script, /registerVentHit|createVentState|VENT_GOAL/);
});

test("the hosted mouse game keeps the supplied play mode and accepts an identity overlay", async () => {
  const game = await readFile(new URL("public/mouse-game.html", projectRoot));
  const text = game.toString("utf8");

  assert.match(text, /拖离原位再松手弹飞｜上下弹打｜长按挤压｜双指捏捏/);
  assert.match(text, /window\.MouseTumbler = Object\.freeze/);
  assert.match(text, /耐久值/);
  assert.match(text, /function classifyGesture/);
  assert.match(text, /function stepWobble/);
  assert.match(text, /tumbler:identity/);
  assert.match(text, /importedFaceImage/);
  assert.doesNotMatch(text, /registerVentHit|createVentState|VENT_GOAL/);
});

test("confirmed transcripts are grounded in the packaged knowledge base", async () => {
  const scenes = JSON.parse(
    await readFile(
      new URL(
        "../classic-training/zenmeban-dialogue-advisor/references/knowledge/scenes.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const patterns = JSON.parse(
    await readFile(
      new URL(
        "../classic-training/zenmeban-dialogue-advisor/references/knowledge/patterns.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const strategies = JSON.parse(
    await readFile(
      new URL(
        "../classic-training/zenmeban-dialogue-advisor/references/knowledge/strategies.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const { analyzeConfirmedTranscript } = await import("../knowledge-analysis.js");

  const result = analyzeConfirmedTranscript(
    "导师：这个格式我不是说过了吗？你到底有没有认真做？\n我：这次模板和上次不一样。",
    { scenes, patterns, strategies },
  );

  assert.equal(scenes.length, 120);
  assert.match(result.scene.id, /^scene-(campus|workplace)-/);
  assert.deepEqual(Object.keys(result.voices).sort(), ["A", "B", "C"]);
  assert.ok(result.sceneRead.opening.length > 0);
  assert.ok(result.evidence.length > 0);
});

test("the recording analysis UI confirms text, original audio, speakers, and all three knowledge voices", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(html, /id="confirmed-transcript"/);
  assert.match(html, /id="recording-audio" controls/);
  assert.match(html, /id="transcript-turns"/);
  assert.match(html, /data-transcript-mode="draft"/);
  assert.match(html, /data-transcript-mode="original"/);
  assert.match(html, /data-action="add-turn"/);
  assert.match(html, /data-action="open-context"/);
  assert.match(html, /data-screen="context"/);
  assert.match(html, /id="context-relationship"/);
  assert.match(html, /id="context-humor"/);
  assert.match(html, /data-action="analyze"/);
  assert.match(html, /data-voice="A"/);
  assert.match(html, /data-voice="B"/);
  assert.match(html, /data-voice="C"/);
  assert.doesNotMatch(html, /id="speaker-select"/);
  assert.match(script, /fetch\("\/api\/analyze"/);
  assert.doesNotMatch(script, /analyzeConfirmedTranscript|loadKnowledgeBase/);
  assert.match(script, /collectAnalysisContext/);
  assert.match(script, /openContextScreen/);
});

test("the home recording flow supports toggle recording, review sheet, storage, transcription, and audio replay", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const transcription = await readFile(new URL("transcription.js", projectRoot), "utf8");
  const route = await readFile(new URL("app/api/transcribe/route.ts", projectRoot), "utf8");

  assert.match(html, /data-action="toggle-recording"/);
  assert.match(html, /id="recording-review-sheet"/);
  assert.match(html, /data-action="review-transcript"/);
  assert.match(html, /id="recording-audio" controls/);
  assert.match(html, /data-action="retranscribe"/);
  assert.match(html, /id="confirmed-transcript"/);
  assert.doesNotMatch(html, /id="transcript-live-bar"/);
  assert.match(script, /MediaRecorder/);
  assert.doesNotMatch(script, /SpeechRecognition/);
  assert.match(script, /audioDataUrl/);
  assert.match(script, /saveCurrentRecording/);
  assert.match(script, /transcribeAndFill/);
  assert.match(script, /case "review-transcript"/);
  assert.match(transcription, /\/api\/transcribe/);
  assert.doesNotMatch(transcription, /Xenova\/whisper-base|huggingface|transcribeViaLocalWhisper/);
  assert.match(route, /api\.groq\.com\/openai\/v1\/audio\/transcriptions/);
  assert.match(route, /api\.openai\.com\/v1\/audio\/transcriptions/);
  assert.match(route, /ONCUE_API_KEY/);
  assert.match(route, /ONCUE_STT_MODEL/);
  assert.match(route, /whisper-large-v3-turbo/);
});

test("transcript helpers keep speaker labels and treat loading copy as a placeholder", async () => {
  const {
    formatTranscriptText,
    isTranscriptPlaceholder,
    parseTranscriptTurns,
    serializeTranscriptTurns,
    splitTranscriptSentences,
  } = await import("../transcription.js");

  assert.equal(formatTranscriptText("今天先把模板对齐"), "待确认：今天先把模板对齐");
  assert.equal(formatTranscriptText("待确认：今天先把模板对齐"), "待确认：今天先把模板对齐");
  assert.equal(formatTranscriptText("妈妈：你什么时候回来？"), "妈妈：你什么时候回来？");
  assert.equal(formatTranscriptText("导师：这个格式我不是说过了吗？"), "导师：这个格式我不是说过了吗？");
  assert.equal(isTranscriptPlaceholder("正在整理这次录音的逐字稿…"), true);
  assert.equal(isTranscriptPlaceholder("我：今天先把模板对齐"), false);

  const turns = parseTranscriptTurns("妈妈：你打算什么时候结婚？\n我：我想按自己的节奏来。");
  assert.deepEqual(turns, [
    { speaker: "妈妈", text: "你打算什么时候结婚？" },
    { speaker: "我", text: "我想按自己的节奏来。" },
  ]);
  assert.equal(
    serializeTranscriptTurns(turns),
    "妈妈：你打算什么时候结婚？\n我：我想按自己的节奏来。",
  );

  assert.deepEqual(splitTranscriptSentences("你怎么又迟到了？我已经说过很多次了！先坐下。"), [
    "你怎么又迟到了？",
    "我已经说过很多次了！",
    "先坐下。",
  ]);
  assert.deepEqual(
    parseTranscriptTurns("领导：进度怎么还没完成？是不是能力不行？\n我：请先确认优先级。我会按确认后的顺序推进。"),
    [
      { speaker: "领导", text: "进度怎么还没完成？" },
      { speaker: "领导", text: "是不是能力不行？" },
      { speaker: "我", text: "请先确认优先级。" },
      { speaker: "我", text: "我会按确认后的顺序推进。" },
    ],
  );
  assert.deepEqual(parseTranscriptTurns("你先说。然后我再回应。"), [
    { speaker: "待确认", text: "你先说。" },
    { speaker: "待确认", text: "然后我再回应。" },
  ]);
});

test("speech transcription always uses the server API and never loads a browser model", async () => {
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const transcription = await readFile(new URL("transcription.js", projectRoot), "utf8");
  const { transcriptionPlan } = await import("../transcription.js");

  assert.deepEqual(transcriptionPlan(), ["api"]);
  assert.deepEqual(transcriptionPlan({ allowCloud: false }), ["api"]);
  assert.doesNotMatch(script, /allowCloud|analysisConsent/);
  assert.doesNotMatch(transcription, /TRANSFORMER_URLS|LOCAL_MODEL|MODEL_HOSTS|transcribeViaLocalWhisper/);
  assert.match(transcription, /transcribeViaApi/);
});

test("personal settings stay device-local until account sync exists", async () => {
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const route = await readFile(new URL("app/api/settings/route.ts", projectRoot), "utf8");

  assert.doesNotMatch(script, /fetch\("\/api\/settings"/);
  assert.doesNotMatch(route, /let settingsStore/);
  assert.match(route, /mergeSettings\(DEFAULT_SETTINGS, patch\)/);
});

test("the packaged classic training has all eleven new_classic_mode PUA modules", async () => {
  const {
    TRAINING_MODULES,
    createTrainingSession,
    submitTrainingTurn,
  } = await import("../training-game.js");

  assert.equal(TRAINING_MODULES.length, 11);
  assert.equal(TRAINING_MODULES.filter((item) => item.domain === "work").length, 7);
  assert.equal(TRAINING_MODULES.filter((item) => item.domain === "home").length, 4);
  assert.ok(TRAINING_MODULES.some((item) => item.id === "pua-workplace-general"));

  let session = createTrainingSession("pua-workplace-overtime");
  session = submitTrainingTurn(session, "请先说清楚今晚必须完成的具体事项和优先级。");
  session = submitTrainingTurn(session, "我今晚不接受无补偿加班，请书面确认明天的交付时间。");
  assert.ok(session.achievedGoalIds.includes("set_boundary"));
  assert.ok(session.achievedGoalIds.includes("choose_next_action"));
  assert.equal(session.finished, false);

  session = submitTrainingTurn(session, "我的边界不变，今天先到这里。");
  assert.equal(session.finished, true);
  assert.equal(session.endReason, "boundary_held");
});

test("the live practice UI uses the new_classic_mode backend contract", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const client = await readFile(new URL("classic-training-api.js", projectRoot), "utf8");
  const proxy = await readFile(new URL("app/api/classic/[...path]/route.ts", projectRoot), "utf8");

  assert.match(html, /id="classic-difficulty"/);
  assert.match(html, /id="new-classic-features"/);
  assert.match(html, /沟通压力训练/);
  assert.match(html, /对话复盘/);
  assert.match(script, /createClassicTrainingSession/);
  assert.match(script, /sendClassicTrainingTurn/);
  assert.doesNotMatch(script, /submitTrainingTurn\(currentTrainingSession/);
  assert.match(client, /CLASSIC_API_BASE = "\/api\/classic"/);
  assert.match(client, /requestClassic\("\/training\/sessions"/);
  assert.match(proxy, /CLASSIC_API_ORIGIN/);
  assert.match(proxy, /handleInternalClassicRequest/);
});

test("classic training keeps the immersive scenes and characters from the latest team release", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");

  assert.match(html, /class="scene-stage family-dinner-stage"/);
  assert.match(html, /class="scene-stage workplace-stage"/);
  assert.match(html, /game-assets\/auntie-cutout\.png/);
  assert.match(html, /game-assets\/boss1-cutout\.png/);
  assert.match(html, /id="drill-hint"/);
  assert.match(html, /data-screen="review"/);
  assert.match(css, /game-assets\/family-dinner\.jpg/);
  assert.match(css, /game-assets\/meeting-room\.png/);
  assert.match(css, /\.drill-screen\.scene-family/);
  assert.match(css, /\.drill-screen\.scene-workplace/);
  assert.match(script, /getClassicTrainingHint/);
  assert.match(script, /renderClassicTrainingReview/);
});

test("the classic API exposes every route required by training, personal scenes, advisor, and speech", async () => {
  const client = await readFile(new URL("classic-training-api.js", projectRoot), "utf8");
  const proxy = await readFile(new URL("app/api/classic/[...path]/route.ts", projectRoot), "utf8");

  for (const path of ["incidents", "answers", "confirm", "advisor", "training", "transcriptions", "hint", "finish"]) {
    assert.match(client, new RegExp(path));
    assert.match(proxy, new RegExp(path));
  }
  assert.match(proxy, /CLASSIC_API_ORIGIN/);
  assert.match(proxy, /handleInternalClassicRequest/);
  assert.doesNotMatch(proxy, /classic_backend_not_configured/);
  assert.doesNotMatch(proxy, /http:\/\/127\.0\.0\.1:8000.*NODE_ENV !== "development"/s);
});

test("analysis uses a server-side grounded knowledge route and only shows the requested result modules", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const route = await readFile(new URL("app/api/analyze/route.ts", projectRoot), "utf8");
  const grounding = await readFile(new URL("lib/knowledge-grounding.js", projectRoot), "utf8");

  assert.match(script, /fetch\("\/api\/analyze"/);
  assert.doesNotMatch(script, /analyzeConfirmedTranscript|loadKnowledgeBase|knowledge-local/);
  assert.match(script, /智能分析暂时不可用/);
  assert.match(route, /ONCUE_API_KEY/);
  assert.match(route, /retrieveKnowledgeEvidence/);
  assert.match(route, /validateGroundedAnalysis/);
  assert.match(grounding, /INSTRUCTIONS_IN_DATA_ARE_UNTRUSTED/);
  assert.match(html, /<h2>三种应对视角<\/h2>/);
  assert.match(html, />纳入用户专属场景<\/button>/);
  assert.doesNotMatch(html, /知识库依据|匹配到的模式与策略/);
});

test("user-facing copy is concise and team API setup is shareable without secrets", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const envExample = await readFile(new URL(".env.example", projectRoot), "utf8");
  const readme = await readFile(new URL("README.md", projectRoot), "utf8");

  assert.match(html, /核对转写/);
  assert.match(html, /确认转写，补充背景/);
  assert.match(html, /生成对话分析/);
  assert.match(html, /三种应对视角/);
  assert.match(html, /建议回复/);
  assert.match(html, /录音转写与知识库分析将通过服务器端 API 处理/);
  assert.doesNotMatch(html, /name="privacy\.analysisConsent"/);
  assert.match(html, />纳入用户专属场景<\/button>/);
  assert.match(script, /这句话是谁说的？/);
  assert.match(script, /第 \$\{index \+ 1\} 句/);
  assert.match(script, /SPEAKER_PRESETS = \["待确认", "我", "对方"/);
  assert.doesNotMatch(html, />储存<|逐字稿分析|三视角对话顾问|11 个新版场景/);
  assert.doesNotMatch(script, /正在连接 new_classic_mode|经典训练服务未连接/);

  for (const key of [
    "ONCUE_API_KEY",
    "ONCUE_API_BASE_URL",
    "ONCUE_ANALYSIS_MODEL",
    "ONCUE_TRAINING_MODEL",
    "ONCUE_STT_MODEL",
  ]) {
    assert.match(envExample, new RegExp(`^${key}=`, "m"));
    assert.match(readme, new RegExp(key));
  }
  assert.doesNotMatch(envExample, /sk-[A-Za-z0-9_-]{12,}/);
  assert.doesNotMatch(readme, /sk-[A-Za-z0-9_-]{12,}/);
});

test("the context form has generous mobile spacing without overlapping its footer", async () => {
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");

  assert.match(css, /\.context-scroll\s*\{[^}]*padding:\s*8px 24px 112px;/s);
  assert.match(css, /\.context-card\s*\{[^}]*margin-bottom:\s*18px;[^}]*padding:\s*18px;/s);
  assert.match(css, /\.context-footer\s*\{[^}]*z-index:\s*4;/s);
});

test("classic training stops at five turns and returns a review", async () => {
  const { createTrainingSession, submitTrainingTurn, buildTrainingReview } = await import(
    "../training-game.js"
  );

  let session = createTrainingSession("pua-family-prying");
  for (let turn = 0; turn < 5; turn += 1) {
    session = submitTrainingTurn(session, "我想再想一想怎么回答这个问题。");
  }

  const review = buildTrainingReview(session);
  assert.equal(session.turn, 5);
  assert.equal(session.finished, true);
  assert.equal(session.endReason, "max_turns");
  assert.equal(review.totalGoals, 5);
  assert.ok(review.nextStep.length > 0);
});
