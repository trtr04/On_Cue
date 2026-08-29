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

test("the emotion impact game tracks hits, combos, and completion", async () => {
  const { createVentState, registerVentHit } = await import("../vent-game.js");
  const initial = createVentState();
  const first = registerVentHit(initial, { power: 1, now: 1_000 });
  const charged = registerVentHit(first, { power: 3, now: 1_500 });
  const resetCombo = registerVentHit(charged, { power: 1, now: 3_000 });

  assert.deepEqual(first, {
    totalHits: 1,
    combo: 1,
    bestCombo: 1,
    lastHit: 1_000,
    progress: 1 / 30,
    complete: false,
  });
  assert.equal(charged.totalHits, 4);
  assert.equal(charged.combo, 4);
  assert.equal(charged.bestCombo, 4);
  assert.equal(resetCombo.combo, 1);

  let state = createVentState();
  for (let index = 0; index < 30; index += 1) {
    state = registerVentHit(state, { power: 1, now: index * 100 });
  }
  assert.equal(state.progress, 1);
  assert.equal(state.complete, true);
});

test("the emotion game is wired into the vent screen", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(html, /id="vent-progress-bar"/);
  assert.match(html, /id="vent-total"/);
  assert.match(html, /data-action="reset-vent"/);
  assert.match(script, /registerVentHit/);
  assert.match(script, /navigator\.vibrate/);
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

test("the emotion game uses the packaged bow character IP", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const script = await readFile(new URL("app.js", projectRoot), "utf8");

  assert.match(html, /id="vent-mascot"[^>]+honey-badger-game\.svg/);
  assert.doesNotMatch(html, /id="vent-mascot"[^>]+panda-jump\.png/);
  assert.doesNotMatch(script, /ventMascot\.src\s*=\s*[^;]*panda-(?:happy|jump)/);
});

test("the packaged classic training has ten interactive PUA modules", async () => {
  const {
    TRAINING_MODULES,
    createTrainingSession,
    submitTrainingTurn,
  } = await import("../training-game.js");

  assert.equal(TRAINING_MODULES.length, 10);
  assert.equal(TRAINING_MODULES.filter((item) => item.domain === "work").length, 6);
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
