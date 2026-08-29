import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

test("the home layout prioritizes the lower action area", async () => {
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");

  assert.match(css, /\.home-mascot\s*\{[^}]*width:\s*256px;[^}]*height:\s*210px;/s);
  assert.match(css, /\.home-inbox\s*\{[^}]*top:\s*438px;[^}]*height:\s*294px;/s);
});

test("recording and analysis screens remain stacked inside the phone", async () => {
  const css = await readFile(new URL("styles.css", projectRoot), "utf8");

  assert.match(css, /\.recording-screen,\s*\.analysis-screen\s*\{\s*position:\s*absolute;/s);
});

test("phone scaling fits every viewport without cropping", async () => {
  const { computePhoneScale } = await import("../responsive.js");

  assert.equal(computePhoneScale(390, 844), 1);
  assert.equal(computePhoneScale(375, 667), 667 / 844);
  assert.equal(computePhoneScale(430, 932), 430 / 390);
  assert.equal(computePhoneScale(844, 390), 390 / 844);
});

test("the emotion game embeds the supplied standalone game without the replacement UI", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(html, /<iframe[^>]+id="mouse-game-frame"[^>]+src="\/mouse-game\.html"/);
  assert.doesNotMatch(html, /id="vent-stage"|id="vent-total"|honey-badger-game\.svg/);
  assert.doesNotMatch(script, /registerVentHit|createVentState|VENT_GOAL/);
});

test("the hosted mouse game is byte-identical to the supplied package", async () => {
  const game = await readFile(new URL("public/mouse-game.html", projectRoot));
  const digest = createHash("sha256").update(game).digest("hex");
  const text = game.toString("utf8");

  assert.equal(digest, "202c776e16d00e2b0002bf3792e561d3580d79fadbdcb1d1c1c388c8a63ef7c1");
  assert.match(text, /拖离原位再松手弹飞｜上下弹打｜长按挤压｜双指捏捏/);
  assert.match(text, /window\.MouseTumbler = Object\.freeze/);
  assert.match(text, /耐久值/);
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

test("the recording analysis UI confirms text and exposes all three knowledge voices", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(html, /id="confirmed-transcript"/);
  assert.match(html, /data-voice="A"/);
  assert.match(html, /data-voice="B"/);
  assert.match(html, /data-voice="C"/);
  assert.match(script, /analyzeConfirmedTranscript/);
  assert.match(script, /loadKnowledgeBase/);
});

test("the packaged classic training has eleven interactive PUA modules", async () => {
  const {
    TRAINING_MODULES,
    createTrainingSession,
    submitTrainingTurn,
  } = await import("../training-game.js");

  assert.equal(TRAINING_MODULES.length, 11);
  assert.equal(TRAINING_MODULES.filter((item) => item.domain === "work").length, 7);
  assert.equal(TRAINING_MODULES.filter((item) => item.domain === "home").length, 4);

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

test("the merged UI runs classic training through the backend API", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const client = await readFile(new URL("classic-api-client.js", projectRoot), "utf8");
  const proxy = await readFile(new URL("app/api/classic/[...path]/route.ts", projectRoot), "utf8");

  assert.match(script, /import \{ classicTraining \} from "\.\/classic-api-client\.js"/);
  assert.doesNotMatch(script, /from "\.\/training-game\.js"/);
  assert.match(script, /training_mode === "pua_response"/);
  assert.match(client, /const API_ROOT = "\/api\/classic"/);
  assert.match(client, /classicApi\("\/scenarios"\)/);
  assert.match(client, /adviseIncident/);
  assert.match(proxy, /CLASSIC_API_ORIGIN/);
  assert.match(html, /data-screen="review"/);
  assert.doesNotMatch(script, /真实模型/);
});

test("workplace PUA levels visibly separate general and women-specific training", async () => {
  const script = await readFile(new URL("app.js", projectRoot), "utf8");
  const modules = await readFile(
    new URL("../classic-training/backend/app/pua_modules.py", import.meta.url),
    "utf8",
  );

  assert.match(script, /general-workplace-pua-title/);
  assert.match(script, /通用职场 PUA/);
  assert.match(script, /女性职场 PUA/);
  assert.match(script, /item\.id === "pua-workplace-general"/);
  assert.match(modules, /"module_id": "pua-workplace-general"/);
  assert.match(modules, /"target_group": "general"/);
});

test("the classic backend no longer serves its legacy cream frontend", async () => {
  const backendMain = await readFile(
    new URL("../classic-training/backend/app/main.py", import.meta.url),
    "utf8",
  );
  const legacyFrontend = await readFile(
    new URL("../classic-training/frontend/index.html", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(backendMain, /StaticFiles|frontend\/index\.html|FileResponse/);
  assert.match(backendMain, /RedirectResponse\(url=settings\.team_ui_origin/);
  assert.match(legacyFrontend, /window\.location\.replace\("http:\/\/localhost:3000\/"\)/);
});

test("real incident intake supports speakers, three feedback voices, text, and voice", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(html, /id="incident-workspace"/);
  assert.match(html, /data-purpose="incident_narration"/);
  assert.match(script, /speaker_id/);
  assert.match(script, /feedback\.voice_order\.map/);
  assert.match(script, /feedback\.voice_versions\[id\]/);
  assert.match(script, /生成 A \/ B \/ C/);
  assert.match(script, /WavRecorder/);
});
