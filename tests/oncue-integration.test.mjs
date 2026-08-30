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

  assert.match(html, /data-action="start-recording"/);
  assert.match(html, /id="home-recording-controls"/);
  assert.match(html, /class="history-button" data-action="history-list"/);
  assert.match(html, /\/assets\/mic-record-large\.svg/);
  assert.doesNotMatch(html, /今日主要任务|记录一次没说完的话/);
  assert.doesNotMatch(html, /id="home-inbox"/);
  assert.match(css, /\.home-chat-bubble\s*\{/);
  assert.match(css, /\.home-record\s*\{[^}]*width:\s*274px;[^}]*height:\s*230px;/s);
  assert.match(css, /\.recording-review-sheet\s*\{/);
});

test("active recording content stays vertically separated from controls and navigation", async () => {
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");

  assert.match(css, /\.home-record\.is-recording,\s*\.home-record\.is-paused\s*\{[^}]*top:\s*442px;[^}]*height:\s*204px;[^}]*grid-template-rows:\s*92px 28px 32px 40px;/s);
  assert.match(css, /\.home-recording-controls\s*\{[^}]*top:\s*660px;/s);
  assert.match(css, /\.figma-nav\s*\{[^}]*top:\s*742px;/s);
});

test("practice conversations use free input without the horizontal quick-reply module", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");

  assert.match(html, /<form class="drill-composer" id="drill-form">/);
  assert.doesNotMatch(html, /id="drill-suggestions"|data-suggest=/);
  assert.doesNotMatch(css, /\.drill-suggestions/);
  assert.doesNotMatch(script, /drillSuggestions|renderSuggestions|data-suggest/);
  assert.match(script, /drillInput\.value\s*=\s*lines\[0\]/);
});

test("recording completion can return safely and saved recordings can be confirmed then deleted", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(html, /data-action="close-recording-review"[^>]*>\s*返回\s*</);
  assert.match(script, /function deleteRecording\(recordingId\)/);
  assert.match(script, /window\.confirm\("确定删除这条录音记录吗？"\)/);
  assert.match(script, /data-action="delete-recording"/);
  assert.match(script, /case "close-recording-review":/);
  assert.doesNotMatch(
    script,
    /case "close-recording-review":[\s\S]{0,140}showScreen\("home"\)/,
    "the recording sheet already overlays home; navigating home immediately reopens it",
  );
  assert.match(script, /case "delete-recording":/);
});

test("server APIs read Sites runtime bindings instead of relying only on process.env", async () => {
  const runtimeEnv = await readFile(new URL("lib/runtime-env.ts", projectRoot), "utf8");
  const service = await readFile(new URL("lib/classic-service.ts", projectRoot), "utf8");
  const analysis = await readFile(new URL("app/api/analyze/route.ts", projectRoot), "utf8");
  const transcribe = await readFile(new URL("app/api/transcribe/route.ts", projectRoot), "utf8");

  assert.match(runtimeEnv, /from "cloudflare:workers"/);
  for (const source of [service, analysis, transcribe]) {
    assert.match(source, /runtimeEnv\(/);
  }
});

test("classic dialogue must directly answer the latest user turn and reject generic evasions", async () => {
  const {
    buildTrainingRoleMessages,
    isWeakTrainingReply,
  } = await import("../lib/training-dialogue.js");

  const messages = buildTrainingRoleMessages({
    module: {
      title: "被拿来和别人比较",
      role: "用比较施压的长辈",
      summary: "用别人家的孩子制造压力。",
    },
    pressure: "中度",
    evidenceText: '[{"text":"我都是为你好"}]',
    messages: [
      { role: "assistant", content: "我还不是为你好。" },
      { role: "user", content: "为我好什么？" },
    ],
    close: false,
  });

  const prompt = messages.map((item) => item.content).join("\n");
  assert.match(prompt, /当前用户最新一句/);
  assert.match(prompt, /为我好什么/);
  assert.match(prompt, /先正面回答/);
  assert.equal(isWeakTrainingReply("那你自己看着办吧。", "为我好什么？", false), true);
  assert.equal(isWeakTrainingReply("我是怕你以后吃亏，才一直拿别人和你比。", "为我好什么？", false), false);
});

test("every packaged legacy level uses the model API instead of fixed reply arrays", async () => {
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const client = await readFile(new URL("classic-training-api.js", projectRoot), "utf8");
  const service = await readFile(new URL("lib/classic-service.ts", projectRoot), "utf8");

  for (const id of ["progress", "public", "overtime", "marriage", "compare", "group", "delay"]) {
    assert.match(script, new RegExp(`"${id}"\\s*:\\s*"pua-`));
  }
  assert.match(script, /createClassicTrainingSession\(trainingModuleId, selectedClassicDifficulty/);
  assert.doesNotMatch(script, /currentDrill\.replies\[/);
  assert.match(client, /display_title/);
  assert.match(client, /display_role/);
  assert.match(service, /display_title/);
  assert.match(service, /session\.presentation/);
});

test("the transcription provider has a working OpenAI Next fallback before overloaded mini models", async () => {
  const route = await readFile(new URL("app/api/transcribe/route.ts", projectRoot), "utf8");

  assert.match(route, /model:\s*"gpt-4o-transcribe"/);
  assert.ok(route.indexOf('model: "gpt-4o-transcribe"') < route.indexOf('model: "gpt-4o-mini-transcribe"'));
});

test("the practice and emotion tabs omit the requested duplicate and explanatory content", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");
  const mouseGame = await readFile(new URL("mouse-tumbler/index.html", projectRoot), "utf8");

  assert.doesNotMatch(html, /id="new-classic-features"|class="new-classic-features"/);
  assert.doesNotMatch(css, /\.new-classic-features/);
  assert.doesNotMatch(html, /data-i18n="vent-copy"/);
  assert.doesNotMatch(script, /"vent-copy"/);
  assert.doesNotMatch(mouseGame, /拖离原位再松手弹飞｜上下弹打｜长按挤压｜双指捏捏/);
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

  assert.match(html, /<iframe[^>]+id="mouse-game-frame"[^>]+src="\/mouse-tumbler\/index\.html"/);
  assert.match(html, /id="vent-face-input"/);
  assert.match(html, /id="vent-name-input"/);
  assert.match(html, /data-screen="vent"[\s\S]*data-action="tab-vent"/);
  assert.match(css, /\.vent-screen\s*\{\s*background:\s*var\(--brand-soft\)/);
  assert.match(script, /tumbler:identity/);
  assert.doesNotMatch(html, /id="vent-stage"|id="vent-total"|honey-badger-game\.svg/);
  assert.doesNotMatch(script, /registerVentHit|createVentState|VENT_GOAL/);
});

test("the hosted mouse game keeps the team's latest play mode, face pack, and identity overlay", async () => {
  const game = await readFile(new URL("public/mouse-tumbler/index.html", projectRoot));
  const text = game.toString("utf8");

  assert.doesNotMatch(text, /拖离原位再松手弹飞｜上下弹打｜长按挤压｜双指捏捏/);
  assert.match(text, /window\.MouseTumbler = Object\.freeze/);
  assert.match(text, /耐久值/);
  assert.match(text, /function classifyGesture/);
  assert.match(text, /function stepWobble/);
  assert.match(text, /tumbler:identity/);
  assert.match(text, /importedFaceImage/);
  assert.match(text, /id="facePack"/);
  assert.match(text, /tumbler:sticker-picked/);
  for (const face of ["angry", "confused", "cry", "happy", "sad"]) {
    await readFile(new URL(`public/mouse-tumbler/assets/tumbler-faces/pack/${face}.png`, projectRoot));
  }
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

test("current confirmed dialogue drives all three packaged role analyses", async () => {
  const profiles = JSON.parse(
    await readFile(
      new URL(
        "../classic-training/zenmeban-dialogue-advisor/references/core/voice-profiles.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const router = JSON.parse(
    await readFile(
      new URL(
        "../classic-training/zenmeban-dialogue-advisor/references/core/voice-router.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const {
    buildGroundedPrompt,
    buildSingleSkillPrompt,
    skillVoiceQualityIssues,
    validateGroundedAnalysis,
  } = await import("../lib/knowledge-grounding.js");
  const retrieved = [{
    score: 88,
    scene: {
      id: "scene-reference-only",
      title: "历史参考场景",
      scene_category: "职场",
      scene_archetype: "参考卡",
      observable_facts: ["历史材料里的句子"],
      possible_interpretations: [],
      missing_information: [],
      pattern_refs: [],
      strategy_refs: [],
      risk_level: "none",
      avoid: [],
    },
  }];
  const transcript = "领导：这份方案全部重做。\n我：请先说明需要修改的具体部分。";
  const prompt = buildGroundedPrompt({
    transcript,
    context: "关系：直属领导",
    segments: [
      { id: "seg-1", speakerId: "领导", text: "这份方案全部重做。", startMs: 0, endMs: 1000, confidence: 1, isUserEdited: true },
      { id: "seg-2", speakerId: "我", text: "请先说明需要修改的具体部分。", startMs: 1000, endMs: 2000, confidence: 1, isUserEdited: true },
    ],
    retrieved,
    voiceProfiles: profiles,
    voiceRouter: router,
  });

  assert.match(prompt, /当前确认对话是唯一的事实来源/);
  assert.ok(prompt.indexOf(transcript) < prompt.indexOf("历史知识卡"));
  assert.match(prompt, /价值交换型强判断/);
  assert.match(prompt, /人情世故与高情商话术/);
  assert.match(prompt, /位置、系统与结果操盘/);

  const rolePrompt = buildSingleSkillPrompt({
    transcript,
    context: "关系：直属领导",
    segments: [],
    retrieved,
    profile: profiles[0],
  });
  assert.match(rolePrompt, /ququ-perspective/);
  assert.match(rolePrompt, /清醒阿曲/);
  assert.match(rolePrompt, /只生成当前这一位朋友/);
  assert.match(rolePrompt, /evidence_quote/);
  assert.ok(skillVoiceQualityIssues({
    voice: {
      evidence_quote: "这份方案全部重做",
      headline: "需要沟通",
      position: "用户需要理解对方。",
      analysis: "双方要互相理解，找到都能接受的解决方案。",
      direct_reply: "我们再沟通一下。",
    },
  }, profiles[0], transcript).length > 0);

  const voice = (id) => ({
    voice_id: id,
    display_name: id,
    evidence_quote: "这份方案全部重做",
    headline: `${id} 对当前对话的判断`,
    position: `${id} 的独立立场`,
    analysis: `${id} 只分析刚才的对话`,
    direct_reply: `${id} 的建议回复`,
    tone_tags: [id],
    style_intensity: "strong",
    safety_override: false,
  });
  const result = validateGroundedAnalysis({
    title: "本次方案修改沟通",
    scene: "直属领导要求全部重做",
    summary: "双方需要把修改范围说清楚",
    evidence: ["这份方案全部重做"],
    scene_read: {
      opening: "我听下来，你们卡在修改范围没有被说清楚。",
      key_detail: "对方要求全部重做，但没有说明具体部分。",
      where_it_is_stuck: "修改标准不明确。",
      need_to_confirm: "需要确认修改范围和验收标准。",
    },
    ambiguity_analysis: {
      observable_facts: ["这份方案全部重做", "请先说明需要修改的具体部分"],
      primary_interpretation: { confidence: "medium" },
    },
    voice_versions: { A: voice("A"), B: voice("B"), C: voice("C") },
    primary_voice: "C",
    voice_order: ["C", "A", "B"],
    uncertainty: "尚未看到具体修改清单。",
    risk_level: "none",
  }, retrieved, { patterns: [], strategies: [] }, { transcript, voiceProfiles: profiles });

  assert.equal(result.currentDialogue.title, "本次方案修改沟通");
  assert.deepEqual(result.evidence, ["这份方案全部重做", "请先说明需要修改的具体部分"]);
  assert.equal(result.referenceScene.id, "scene-reference-only");
  assert.equal(result.voices.A.display_name, "清醒阿曲");
  assert.equal(result.voices.B.display_name, "圆融阿情");
  assert.equal(result.voices.C.display_name, "行动小胜");
  assert.equal(result.voices.A.roleLabel, "现实锋利的清醒型朋友");
  assert.equal(result.voices.B.roleLabel, "圆融体面的高情商朋友");
  assert.equal(result.voices.C.roleLabel, "强结果导向的行动型朋友");
});

test("three analysis roles are named from distinct skill personalities and called independently", async () => {
  const profiles = JSON.parse(await readFile(
    new URL("classic-training/zenmeban-dialogue-advisor/references/core/voice-profiles.json", projectRoot),
    "utf8",
  ));
  const route = await readFile(new URL("app/api/analyze/route.ts", projectRoot), "utf8");
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.deepEqual(profiles.map((profile) => profile.skill_source), [
    "ququ-perspective",
    "renqing",
    "xie-shengzi-perspective",
  ]);
  assert.deepEqual(profiles.map((profile) => profile.display_name), ["清醒阿曲", "圆融阿情", "行动小胜"]);
  assert.deepEqual(profiles.map((profile) => profile.personality_label), [
    "现实锋利的清醒型朋友",
    "圆融体面的高情商朋友",
    "强结果导向的行动型朋友",
  ]);
  assert.match(route, /Promise\.all\(/);
  assert.match(route, /buildSingleSkillPrompt/);
  assert.match(html, /三位性格朋友/);
  assert.match(html, /清醒阿曲/);
  assert.match(html, /圆融阿情/);
  assert.match(html, /行动小胜/);
  assert.match(script, /button\.textContent\s*=\s*buttonVoice\.display_name/);
});

test("the home recording flow supports explicit controls, review sheet, storage, transcription, and audio replay", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const transcription = await readFile(new URL("transcription.js", projectRoot), "utf8");
  const route = await readFile(new URL("app/api/transcribe/route.ts", projectRoot), "utf8");

  assert.match(html, /data-action="start-recording"/);
  assert.match(html, /data-action="pause-recording"/);
  assert.match(html, /data-action="stop-recording"/);
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

test("recording has explicit start pause resume and finish controls and stops when leaving", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(html, /id="home-record-control"[^>]+data-action="start-recording"/);
  assert.match(html, /id="home-recording-controls"/);
  assert.match(html, /data-action="pause-recording"[^>]*>暂停<\/button>/);
  assert.match(html, /data-action="resume-recording"[^>]*>继续<\/button>/);
  assert.match(html, /data-action="stop-recording"[^>]*>结束录音<\/button>/);
  assert.doesNotMatch(html, /data-action="toggle-recording"/);
  assert.match(script, /function stopRecording[\s\S]*mediaRecorder\.stop\(\);[\s\S]*releaseAudioStream\(\)/);
  assert.match(script, /id !== "home"[\s\S]*\["recording", "paused"\]\.includes\(recordingState\)[\s\S]*stopRecording\(\{ silent: true \}\)/);
  assert.match(script, /document\.addEventListener\("visibilitychange"[\s\S]*document\.hidden[\s\S]*stopRecording\(\{ silent: true \}\)/);
});

test("analysis requires a current-situation step and every sentence accepts a custom speaker", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(html, /<h1>补充当前情况<\/h1>/);
  assert.match(html, /id="context-situation"/);
  assert.match(html, /当前最需要补充的情况/);
  assert.match(script, /const situation = document\.querySelector\("#context-situation"\)/);
  assert.match(script, /situation \? `当前情况：\$\{situation\}`/);
  assert.match(script, /case "analyze":[\s\S]*currentScreen !== "context"[\s\S]*openContextScreen\(\)/);
  assert.match(html, /data-action="open-context">确认对话，补充当前情况<\/button>/);
  assert.match(script, /placeholder="输入自定义称呼，如客户、姐姐"/);
  assert.match(script, /maxlength="24"/);
  assert.match(script, /normalizeSpeakerName/);
  assert.match(script, /turn\.speakerId = nextValue/);
});

test("returning from transcript keeps the finished recording and edited sentence cards", async () => {
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(script, /function persistCurrentDraft/);
  assert.match(script, /persistCurrentDraft\(\);[\s\S]*await transcribeAndFill/);
  assert.match(script, /syncTranscriptFromTurns\(\)[\s\S]*persistCurrentDraft\(\)/);
  assert.match(script, /id === "home"[\s\S]*recordingState === "stopped"[\s\S]*recordingReviewSheet\.hidden = false/);
  assert.doesNotMatch(script, /case "home":[\s\S]{0,160}prepareRecordingSession/);
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

test("diarized API segments become one editable chat card per sentence and speaker", async () => {
  const { normalizeDiarizedSegments } = await import("../transcription.js");

  const turns = normalizeDiarizedSegments([
    { id: "seg-a", speaker: "A", start: 0, end: 4, text: "你为什么迟到？我已经等很久了。" },
    { id: "seg-b", speaker: "B", start: 4, end: 8, text: "路上临时堵车了。我应该提前告诉你。" },
  ]);

  assert.equal(turns.length, 4);
  assert.deepEqual(turns.map((turn) => turn.speaker), ["对方", "对方", "我", "我"]);
  assert.deepEqual(turns.map((turn) => turn.speakerId), ["A", "A", "B", "B"]);
  assert.deepEqual(turns.map((turn) => turn.text), [
    "你为什么迟到？",
    "我已经等很久了。",
    "路上临时堵车了。",
    "我应该提前告诉你。",
  ]);
  assert.ok(turns.every((turn) => Number.isFinite(turn.startMs) && Number.isFinite(turn.endMs)));
  assert.ok(turns.every((turn) => turn.isUserEdited === false));
});

test("the transcription route requests true speaker diarization and the UI consumes segments", async () => {
  const route = await readFile(new URL("../app/api/transcribe/route.ts", import.meta.url), "utf8");
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(route, /gpt-4o-transcribe-diarize/);
  assert.match(route, /diarized_json/);
  assert.match(route, /segments/);
  assert.match(route, /speakerId/);
  assert.match(script, /applyTranscribedResult/);
  assert.match(script, /result\.segments/);
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

test("classic training retrieves only the knowledge corpus assigned to its module", async () => {
  const women = await readFile(new URL("../女性职场PUA话术.md", import.meta.url), "utf8");
  const family = await readFile(new URL("../家庭PUA话术.md", import.meta.url), "utf8");
  const workplace = await readFile(new URL("../职场PUA话术集合.md", import.meta.url), "utf8");
  const {
    buildTrainingKnowledge,
    retrieveTrainingEvidence,
  } = await import("../lib/training-knowledge.js");

  const knowledge = buildTrainingKnowledge({
    "女性职场PUA话术.md": women,
    "家庭PUA话术.md": family,
    "职场PUA话术集合.md": workplace,
  });
  const familyEvidence = retrieveTrainingEvidence({
    moduleId: "pua-family-marriage",
    query: "你年纪不小了，为什么还不结婚？",
    knowledge,
  });
  const overtimeEvidence = retrieveTrainingEvidence({
    moduleId: "pua-workplace-overtime",
    query: "为什么周末电话打不通，领导都没走",
    knowledge,
  });

  assert.ok(familyEvidence.length > 0);
  assert.ok(familyEvidence.every((item) => item.source === "家庭PUA话术.md"));
  assert.ok(familyEvidence.every((item) => item.section.includes("催婚")));
  assert.ok(overtimeEvidence.length > 0);
  assert.ok(overtimeEvidence.every((item) => item.source === "职场PUA话术集合.md"));
  assert.ok(overtimeEvidence.every((item) => /周末|加班|晚上|休息天|领导还没走|多做一点|额外增加/.test(item.text)));
});

test("each classic module sends its retrieved corpus through the server model API", async () => {
  const service = await readFile(new URL("../lib/classic-service.ts", import.meta.url), "utf8");

  assert.match(service, /retrieveTrainingEvidence/);
  assert.match(service, /模块专属知识库证据/);
  assert.match(service, /source:\s*"module-knowledge\+model"/);
  assert.match(service, /generateTrainingHint/);
  assert.match(service, /generateTrainingReview/);
  assert.doesNotMatch(service, /const PRESSURE_REPLIES|fallback_line/);
});

test("recording review and classic training use separate knowledge routes", async () => {
  const analysisRoute = await readFile(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("../lib/classic-service.ts", import.meta.url), "utf8");
  const corpora = await readFile(new URL("../lib/training-corpora.ts", import.meta.url), "utf8");

  assert.match(analysisRoute, /references\/knowledge\/scenes\.json/);
  assert.match(analysisRoute, /references\/knowledge\/patterns\.json/);
  assert.match(analysisRoute, /references\/knowledge\/strategies\.json/);
  assert.doesNotMatch(analysisRoute, /女性职场PUA话术|家庭PUA话术|职场PUA话术集合/);
  assert.match(service, /trainingKnowledge/);
  assert.match(corpora, /女性职场PUA话术\.md|womenCorpus/);
  assert.match(corpora, /家庭PUA话术\.md|familyCorpus/);
  assert.match(corpora, /职场PUA话术集合\.md|workplaceCorpus/);
});

test("frontend bundles use content hashes so the removed local speech model cannot survive cache", async () => {
  const config = await readFile(new URL("../vite.frontend.config.js", import.meta.url), "utf8");

  assert.match(config, /entryFileNames:\s*"assets\/oncue-\[hash\]\.js"/);
  assert.match(config, /assets\/oncue-\[hash\]\.css/);
});

test("the live practice UI uses the new_classic_mode backend contract", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const client = await readFile(new URL("classic-training-api.js", projectRoot), "utf8");
  const proxy = await readFile(new URL("app/api/classic/[...path]/route.ts", projectRoot), "utf8");

  assert.match(html, /id="classic-difficulty"/);
  assert.doesNotMatch(html, /id="new-classic-features"/);
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
  assert.match(html, /<h2>三位性格朋友<\/h2>/);
  assert.match(html, /用不同性格分析当前对话/);
  assert.match(html, />纳入用户专属场景<\/button>/);
  assert.doesNotMatch(html, /知识库依据|匹配到的模式与策略/);
});

test("user-facing copy is concise and team API setup is shareable without secrets", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const envExample = await readFile(new URL(".env.example", projectRoot), "utf8");
  const readme = await readFile(new URL("README.md", projectRoot), "utf8");

  assert.match(html, /核对转写/);
  assert.match(html, /确认对话，补充当前情况/);
  assert.match(html, /生成对话分析/);
  assert.match(html, /三位性格朋友/);
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
    "ONCUE_DIARIZATION_MODEL",
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
