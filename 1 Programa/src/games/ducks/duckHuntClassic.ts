import type { DuckHuntController, DuckHuntStats, DuckShotTarget } from "./duckHunt3d";
import { getDuckCoverAmount, getDuckResetDuration, type DuckContestant, type DuckForestEventType } from "./duckHuntEngine";
import {
  DUCK_FIELD_WIDTH as W, DUCK_FIELD_HEIGHT as H, DUCK_SPRITE_WIDTH, DUCK_SPRITE_HEIGHT,
  classicDuckPose, classicRefuge, classicTakeoffCover, createClassicDuckPixels, pickClassicDuck,
  type ClassicDuckPose,
} from "./duckClassicMotion";

const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D no disponible.");
  context.imageSmoothingEnabled = false;
  return { canvas, context };
};

/** Original, code-drawn artwork: no Nintendo sprites, sound samples or ROMs. */
const createFieldLayers = () => {
  const back = makeCanvas(W, H);
  const front = makeCanvas(W, H);
  const ctx = back.context;
  const polygon = (context: CanvasRenderingContext2D, color: string, points: number[][]) => {
    context.fillStyle = color; context.beginPath();
    points.forEach(([x, y], i) => i === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
    context.closePath(); context.fill();
  };
  const pixelEllipse = (context: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) => {
    context.fillStyle = color;
    for (let dy = -ry; dy <= ry; dy += 6) {
      const half = Math.floor(Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) * rx / 6) * 6;
      context.fillRect(Math.round(x - half), Math.round(y + dy), half * 2, 6);
    }
  };
  ctx.fillStyle = "#75d3ed"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#9be3ed"; ctx.fillRect(0, 285, W, 160);
  // Clouds are behind the flight field; no bright full-screen shot flashes.
  for (const [x, y, s] of [[296, 75, 1], [652, 122, 0.8], [853, 52, 0.62]]) {
    pixelEllipse(ctx, x, y, 66 * s, 15 * s, "#d9f4ee");
    pixelEllipse(ctx, x - 20 * s, y - 12 * s, 27 * s, 17 * s, "#f5fff3");
    pixelEllipse(ctx, x + 14 * s, y - 18 * s, 32 * s, 21 * s, "#f5fff3");
  }
  polygon(ctx, "#6aba82", [[0, 359], [76, 335], [149, 346], [225, 321], [315, 352], [410, 336], [480, 365], [575, 339], [660, 348], [780, 319], [874, 343], [960, 330], [960, 445], [0, 445]]);
  polygon(ctx, "#41966b", [[0, 380], [83, 367], [177, 387], [263, 360], [361, 381], [468, 375], [583, 392], [708, 368], [854, 377], [960, 358], [960, 460], [0, 460]]);
  // Small woods on the horizon leave the main sky readable even at 200 ducks.
  for (let i = 0; i < 22; i++) {
    const x = i * 49; const y = 390 + Math.sin(i * 1.7) * 9;
    pixelEllipse(ctx, x, y, 32, 24 + i % 4 * 4, i % 2 ? "#297455" : "#347f54");
    ctx.fillStyle = "#275e4e"; ctx.fillRect(x - 2, y + 10, 5, 32);
  }
  ctx.fillStyle = "#73ad36"; ctx.fillRect(0, 411, W, 70);
  // A shallow stream stays in the scenery, away from the actual targets.
  polygon(ctx, "#54bbcc", [[564, 410], [629, 410], [589, 426], [678, 438], [748, 461], [537, 461], [522, 436], [556, 424]]);
  ctx.fillStyle = "#b6eef0";
  for (let i = 0; i < 7; i++) ctx.fillRect(558 + i % 3 * 23, 420 + i * 5, 20, 2);

  const fg = front.context;
  // Oak and undergrowth form one opaque layer, reused as the shot occlusion mask.
  polygon(fg, "#352e27", [[95, 272], [132, 273], [139, 376], [161, 452], [70, 452], [94, 376]]);
  polygon(fg, "#805030", [[104, 283], [123, 283], [121, 385], [142, 449], [88, 449], [108, 374]]);
  polygon(fg, "#aa7542", [[109, 306], [117, 306], [117, 398], [131, 436], [118, 430], [110, 389]]);
  polygon(fg, "#352e27", [[104, 347], [58, 314], [55, 299], [114, 327], [155, 297], [165, 309], [123, 349]]);
  for (const [x, y, rx, ry] of [[62, 253, 51, 46], [117, 229, 60, 58], [162, 269, 39, 47], [111, 286, 70, 44], [43, 284, 36, 33]]) {
    pixelEllipse(fg, x, y, rx, ry, "#214b32");
    pixelEllipse(fg, x - 5, y - 6, rx - 5, ry - 8, "#397b35");
    pixelEllipse(fg, x - 13, y - 16, rx * 0.58, ry * 0.52, "#65a53d");
  }
  for (let i = 0; i < 48; i++) {
    fg.fillStyle = i % 2 ? "#8fc443" : "#244f32";
    fg.fillRect(32 + (i * 37) % 148, 231 + (i * 29) % 71, 6, 4);
  }
  for (const [x, y, rx, ry] of [[18, 430, 52, 28], [150, 438, 43, 29], [857, 438, 72, 35], [937, 424, 65, 54]]) {
    pixelEllipse(fg, x, y, rx, ry, "#214b32");
    pixelEllipse(fg, x - 4, y - 4, rx - 5, ry - 7, "#508e35");
    pixelEllipse(fg, x - 15, y - 13, rx / 2, ry / 2, "#80b93c");
  }
  fg.fillStyle = "#274d2b"; fg.fillRect(0, 455, W, 85);
  fg.fillStyle = "#744b2c"; fg.fillRect(0, 479, W, 61);
  fg.fillStyle = "#c3924c"; fg.fillRect(0, 486, W, 54);
  for (let i = 0; i < 160; i++) {
    const x = i * 6; const top = 437 + (i * 13) % 18;
    fg.fillStyle = i % 3 ? "#84b939" : "#b7d958";
    fg.fillRect(x, top, 3, 475 - top);
    fg.fillRect(x - 3, top - 5, 3, 10);
    fg.fillStyle = "#4a7c30"; fg.fillRect(x + 3, top + 8, 3, 472 - top);
  }
  for (let i = 0; i < 100; i++) {
    fg.fillStyle = i % 2 ? "#dab66b" : "#9c7039";
    fg.fillRect((i * 97) % W, 497 + i % 7 * 6, 6 + i % 4 * 2, 3);
  }
  for (const x of [244, 372, 739, 825]) {
    fg.fillStyle = "#f3e4a0"; fg.fillRect(x - 3, 453, 9, 3); fg.fillRect(x, 450, 3, 9);
    fg.fillStyle = "#df9d38"; fg.fillRect(x, 453, 3, 3);
  }
  const coverPixels = fg.getImageData(0, 0, W, H).data;
  return { back: back.canvas, front: front.canvas, coverPixels };
};

export const createDuckHuntClassic = (
  canvas: HTMLCanvasElement, initialContestants: readonly DuckContestant[],
  onStats?: (stats: DuckHuntStats) => void,
): DuckHuntController => {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("No se pudo preparar el campo de Patos.");
  canvas.width = W; canvas.height = H;
  canvas.dataset.environment = "retro-pixel-meadow";
  canvas.dataset.cameraMode = "classic-fixed";
  canvas.dataset.renderQuality = "pixel-art";
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const layers = createFieldLayers();
  const frames = Array.from({ length: 4 }, (_, i) => createClassicDuckPixels(i));
  const palette = ["", "#192c31", "#765346", "#b2b8a1", "#287c61", "#65b07a", "#f4f1d3", "#f5b646", "#4b5e6a"];
  const sprites = frames.map(pixels => {
    const sprite = makeCanvas(DUCK_SPRITE_WIDTH, DUCK_SPRITE_HEIGHT);
    for (let y = 0; y < DUCK_SPRITE_HEIGHT; y++) for (let x = 0; x < DUCK_SPRITE_WIDTH; x++) {
      const color = pixels[y * DUCK_SPRITE_WIDTH + x];
      if (!color) continue;
      sprite.context.fillStyle = palette[color]; sprite.context.fillRect(x, y, 1, 1);
    }
    return sprite.canvas;
  });
  let contestants = [...initialContestants];
  let living = contestants.filter(duck => !duck.knockedOut);
  let activeIds = new Set<string>();
  let running = false;
  let disposed = false;
  let mode: "ready" | "flight" | "reset" | "escape" = "ready";
  let clockMs = 0;
  let waveStart = 0;
  let transitionStart = 0;
  let forestEvent: DuckForestEventType = "wind";
  let poses: ClassicDuckPose[] = [];
  let resetPoses: ClassicDuckPose[] = [];
  let hitPose: ClassicDuckPose | null = null;
  let powerId: string | null = null;
  let powerUntil = 0;
  let flash: { x: number; y: number; until: number; hit: boolean } | null = null;
  let previousTime = performance.now();
  let statsTime = previousTime;
  let renderedFrames = 0;
  let animationFrame = 0;
  const isFoliage = (x: number, y: number) => {
    const px = Math.floor(x); const py = Math.floor(y);
    return px >= 0 && px < W && py >= 0 && py < H && layers.coverPixels[(py * W + px) * 4 + 3] > 127;
  };
  const drawDuck = (pose: ClassicDuckPose, angle = 0) => {
    if (pose.covered) return;
    context.save(); context.translate(Math.round(pose.x), Math.round(pose.y));
    context.rotate(angle); context.scale(pose.facing, 1);
    context.drawImage(sprites[pose.frame], -pose.width / 2, -pose.height / 2, pose.width, pose.height);
    context.restore();
  };
  const drawWeather = () => {
    const t = clockMs / 1000;
    if (forestEvent === "mist") {
      context.fillStyle = "#e2f4eb"; context.globalAlpha = 0.22;
      for (let i = 0; i < 4; i++) context.fillRect((i * 290 + t * 12) % 1200 - 210, 375 + i * 12, 285, 8);
      context.globalAlpha = 1;
    } else if (forestEvent === "storm") {
      // Gentle rain, not strobing lightning; ducks are drawn afterwards.
      context.fillStyle = "#254866"; context.globalAlpha = 0.2; context.fillRect(0, 0, W, 430); context.globalAlpha = 1;
      context.fillStyle = "#cae7ee";
      for (let i = 0; i < 36; i++) context.fillRect((i * 83 + (reducedMotion ? 0 : t * 40)) % W, (i * 61 + (reducedMotion ? 0 : t * 155)) % 425, 2, 9);
    } else if (forestEvent === "fireflies") {
      context.fillStyle = "#f4f9a2";
      for (let i = 0; i < 16; i++) context.fillRect(50 + i * 55 + Math.sin(reducedMotion ? i : t + i) * 12, 377 + Math.cos(reducedMotion ? i : t * 0.6 + i) * 30, 3, 3);
    } else {
      context.fillStyle = "#bfeadc";
      for (let i = 0; i < 8; i++) context.fillRect((i * 143 + (reducedMotion ? 0 : t * 46)) % W, 394 + i % 3 * 8, 15, 2);
    }
  };
  const render = (now: number) => {
    if (disposed) return;
    // Match the UI wave clock; hidden tabs do not advance or expire the flight.
    const delta = document.hidden ? 0 : Math.max(0, Math.min(350, now - previousTime));
    previousTime = now;
    if (document.hidden) { animationFrame = requestAnimationFrame(render); return; }
    clockMs += delta;
    context.imageSmoothingEnabled = false;
    const quake = !reducedMotion && powerId && clockMs < powerUntil && contestants.find(duck => duck.id === powerId)?.power === "shake";
    context.save();
    if (quake) context.translate(Math.sin(clockMs * 0.04) * 2, Math.cos(clockMs * 0.03) * 2);
    context.drawImage(layers.back, 0, 0);
    drawWeather();
    context.restore();
    poses = [];
    if (mode === "flight" && running) {
      const seconds = (clockMs - waveStart) / 1000;
      const active = living.filter(duck => activeIds.has(duck.id));
      active.forEach((duck, index) => {
        const cover = Math.max(classicTakeoffCover(seconds), getDuckCoverAmount(duck, seconds));
        const pose = classicDuckPose(duck, index, active.length, seconds, cover);
        if (reducedMotion) pose.frame = 1;
        poses.push(pose); drawDuck(pose);
        if (pose.covered && seconds < 0.4) {
          const refuge = classicRefuge(duck);
          context.fillStyle = "#d8ed83";
          context.fillRect(refuge.x - 4, refuge.y - 22, 3, 5);
          context.fillRect(refuge.x + 5, refuge.y - 19, 3, 5);
        }
        if (!pose.covered && powerId === duck.id && clockMs < powerUntil) {
          context.strokeStyle = "#edacfa"; context.lineWidth = 2;
          context.strokeRect(pose.x - pose.width / 2 - 3, pose.y - pose.height / 2 - 3, pose.width + 6, pose.height + 6);
        }
      });
    } else if (mode === "escape") {
      const t = Math.min(1, (clockMs - transitionStart) / 950);
      resetPoses.forEach(pose => drawDuck({ ...pose, y: pose.y - t * (H + pose.y), frame: Math.floor(clockMs / 110) % 4 }));
    } else if (mode === "reset") {
      const t = Math.min(1, (clockMs - transitionStart) / (getDuckResetDuration(contestants.length) * 0.7));
      resetPoses.forEach(pose => {
        if (pose.id === hitPose?.id) return;
        drawDuck({ ...pose, y: pose.y + (H - pose.y) * t, covered: pose.covered || t >= 1 });
      });
      if (hitPose) {
        const fall = Math.max(0, (clockMs - transitionStart - 160) / 720);
        drawDuck({ ...hitPose, y: hitPose.y + fall * fall * 450, frame: 2 }, reducedMotion ? 0 : Math.min(Math.PI / 2, fall * 4));
      }
    }
    context.drawImage(layers.front, 0, 0);
    if (flash && clockMs < flash.until) {
      context.strokeStyle = flash.hit ? "#fff6ba" : "#274450"; context.lineWidth = 3;
      const radius = flash.hit ? 12 : 7;
      context.strokeRect(flash.x - radius, flash.y - radius, radius * 2, radius * 2);
      context.fillStyle = context.strokeStyle;
      for (const side of [-1, 1]) { context.fillRect(flash.x + side * (radius + 5) - 1, flash.y - 1, 3, 3); context.fillRect(flash.x - 1, flash.y + side * (radius + 5) - 1, 3, 3); }
    }
    const visible = poses.filter(pose => !pose.covered).length;
    // Diagnostics expose counts only, never the sealed identities or future result.
    canvas.dataset.activeDucks = String(activeIds.size);
    canvas.dataset.visibleDucks = String(visible);
    canvas.dataset.flightPhase = mode;
    renderedFrames++;
    if (now - statsTime >= 400) {
      onStats?.({ fps: Math.round(renderedFrames * 1000 / (now - statsTime)), visible, renderCalls: visible + 2, triangles: 0 });
      statsTime = now; renderedFrames = 0;
    }
    animationFrame = requestAnimationFrame(render);
  };
  const onVisibility = () => { previousTime = performance.now(); statsTime = previousTime; renderedFrames = 0; };
  document.addEventListener("visibilitychange", onVisibility);
  animationFrame = requestAnimationFrame(render);
  return {
    updateContestants(next) { contestants = [...next]; living = contestants.filter(duck => !duck.knockedOut); },
    setRunning(value) { running = value; if (!value) { mode = "ready"; poses = []; } },
    beginWave(ids) {
      activeIds = new Set(ids); waveStart = clockMs; mode = "flight"; poses = [];
      hitPose = null; flash = null; powerId = null;
    },
    escapeWave() { mode = "escape"; transitionStart = clockMs; resetPoses = poses.map(pose => ({ ...pose })); powerId = null; poses = []; },
    shoot(clientX, clientY) {
      const result: DuckShotTarget = { hitId: null, grazedId: null, threatX: 0, threatY: 0 };
      if (!running || mode !== "flight" || document.hidden) return result;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return result;
      const x = (clientX - rect.left) / rect.width * W; const y = (clientY - rect.top) / rect.height * H;
      result.hitId = pickClassicDuck(poses, x, y, frames, isFoliage);
      result.threatX = x / W * 2 - 1; result.threatY = 1 - y / H * 2;
      flash = { x, y, until: clockMs + (reducedMotion ? 70 : 140), hit: result.hitId !== null };
      return result;
    },
    castPower(id) { powerId = id; powerUntil = clockMs + 1250; },
    setForestEvent(event) { forestEvent = event; canvas.dataset.forestEvent = event; },
    resetFlock(id) {
      hitPose = poses.find(pose => pose.id === id) ?? null;
      resetPoses = poses.map(pose => ({ ...pose })); poses = [];
      mode = "reset"; transitionStart = clockMs; powerId = null;
    },
    regenerateFormation() { waveStart = clockMs; },
    dispose() {
      disposed = true; cancelAnimationFrame(animationFrame);
      document.removeEventListener("visibilitychange", onVisibility);
      poses = []; resetPoses = [];
      for (const cached of [layers.back, layers.front, ...sprites]) { cached.width = 0; cached.height = 0; }
    },
  };
};
