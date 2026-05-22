const state = {
  running: false,
  animationFrame: null,
  lastTime: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  targetX: 0,
  targetY: 0,
  directionChangeAt: 0,
  speed: 1,
  intensity: 0,
  cursorEl: null
};

const SPEED_PRESETS = [
  { accel: 24, maxSpeed: 100, jitter: 0.08, retargetMs: [2200, 4200] },
  { accel: 36, maxSpeed: 160, jitter: 0.12, retargetMs: [1500, 3000] },
  { accel: 50, maxSpeed: 240, jitter: 0.18, retargetMs: [900, 2200] }
];

const INTENSITY_SCALE = [0.45, 0.9, 1.35];

function viewportBounds() {
  return {
    width: Math.max(window.innerWidth || 0, 1),
    height: Math.max(window.innerHeight || 0, 1)
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createCursor() {
  if (state.cursorEl?.isConnected) {
    return state.cursorEl;
  }

  const cursor = document.createElement("div");
  cursor.id = "__human_mouse_drift_cursor__";
  Object.assign(cursor.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "rgba(196, 91, 53, 0.55)",
    boxShadow: "0 0 0 4px rgba(196, 91, 53, 0.12)",
    pointerEvents: "none",
    zIndex: "999999",
    transform: "translate3d(-50%, -50%, 0)",
    transition: "opacity 160ms ease",
    opacity: "0"
  });

  document.documentElement.appendChild(cursor);
  state.cursorEl = cursor;
  return cursor;
}

function setCursorVisible(visible) {
  const cursor = createCursor();
  cursor.style.opacity = visible ? "1" : "0";
}

function updateCursor() {
  if (!state.cursorEl) {
    return;
  }

  state.cursorEl.style.left = `${state.x}px`;
  state.cursorEl.style.top = `${state.y}px`;
}

function chooseNewTarget(now) {
  const { width, height } = viewportBounds();
  const padding = 24;

  state.targetX = randomBetween(padding, Math.max(padding, width - padding));
  state.targetY = randomBetween(padding, Math.max(padding, height - padding));

  const preset = SPEED_PRESETS[state.speed] || SPEED_PRESETS[1];
  const [minMs, maxMs] = preset.retargetMs;
  state.directionChangeAt = now + randomBetween(minMs, maxMs);
}

function ensureStartPosition() {
  const { width, height } = viewportBounds();
  if (!state.x || !state.y) {
    state.x = width * randomBetween(0.35, 0.65);
    state.y = height * randomBetween(0.35, 0.65);
    state.vx = randomBetween(-12, 12);
    state.vy = randomBetween(-12, 12);
    chooseNewTarget(performance.now());
  }
}

function dispatchMoveEvent() {
  const target = document.elementFromPoint(state.x, state.y) || document;
  const event = new MouseEvent("mousemove", {
    bubbles: true,
    cancelable: true,
    clientX: state.x,
    clientY: state.y
  });

  target.dispatchEvent(event);
}

function step(timestamp) {
  if (!state.running) {
    return;
  }

  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.05);
  state.lastTime = timestamp;

  const preset = SPEED_PRESETS[state.speed] || SPEED_PRESETS[1];
  const intensity = INTENSITY_SCALE[state.intensity] || INTENSITY_SCALE[0];

  if (timestamp >= state.directionChangeAt) {
    chooseNewTarget(timestamp);
  }

  const dx = state.targetX - state.x;
  const dy = state.targetY - state.y;
  const distance = Math.hypot(dx, dy) || 1;

  const wanderX = randomBetween(-1, 1) * preset.jitter * intensity * 55;
  const wanderY = randomBetween(-1, 1) * preset.jitter * intensity * 55;
  const accel = preset.accel * dt;

  state.vx += ((dx / distance) * accel * 18) + (wanderX * dt);
  state.vy += ((dy / distance) * accel * 18) + (wanderY * dt);

  const damping = Math.pow(0.82, dt * 60);
  state.vx *= damping;
  state.vy *= damping;

  const speed = Math.hypot(state.vx, state.vy);
  if (speed > preset.maxSpeed) {
    const scale = preset.maxSpeed / speed;
    state.vx *= scale;
    state.vy *= scale;
  }

  const microJitterX = randomBetween(-0.8, 0.8) * intensity;
  const microJitterY = randomBetween(-0.8, 0.8) * intensity;

  state.x += (state.vx * dt) + microJitterX;
  state.y += (state.vy * dt) + microJitterY;

  const { width, height } = viewportBounds();
  const minX = 2;
  const minY = 2;
  const maxX = Math.max(2, width - 2);
  const maxY = Math.max(2, height - 2);

  if (state.x <= minX || state.x >= maxX) {
    state.vx *= -0.55;
    state.targetX = clamp(state.targetX, 28, Math.max(28, width - 28));
  }

  if (state.y <= minY || state.y >= maxY) {
    state.vy *= -0.55;
    state.targetY = clamp(state.targetY, 28, Math.max(28, height - 28));
  }

  state.x = clamp(state.x, minX, maxX);
  state.y = clamp(state.y, minY, maxY);

  updateCursor();
  dispatchMoveEvent();

  state.animationFrame = requestAnimationFrame(step);
}

function startSimulation(config = {}) {
  state.speed = clamp(Number(config.speed) || 0, 0, 2);
  state.intensity = clamp(Number(config.intensity) || 0, 0, 2);
  state.running = true;
  state.lastTime = 0;

  ensureStartPosition();
  setCursorVisible(true);
  updateCursor();
  chooseNewTarget(performance.now());

  if (state.animationFrame !== null) {
    cancelAnimationFrame(state.animationFrame);
  }

  state.animationFrame = requestAnimationFrame(step);
}

function stopSimulation() {
  state.running = false;
  state.lastTime = 0;

  if (state.animationFrame !== null) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }

  setCursorVisible(false);
}

window.addEventListener("resize", () => {
  const { width, height } = viewportBounds();
  state.x = clamp(state.x, 2, Math.max(2, width - 2));
  state.y = clamp(state.y, 2, Math.max(2, height - 2));
  state.targetX = clamp(state.targetX, 24, Math.max(24, width - 24));
  state.targetY = clamp(state.targetY, 24, Math.max(24, height - 24));
  updateCursor();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "HM_START") {
    startSimulation(message.payload);
    sendResponse({
      ok: true,
      running: state.running,
      speed: state.speed,
      intensity: state.intensity
    });
    return;
  }

  if (message?.type === "HM_STOP") {
    stopSimulation();
    sendResponse({ ok: true, running: false });
    return;
  }

  if (message?.type === "HM_GET_STATUS") {
    sendResponse({
      running: state.running,
      speed: state.speed,
      intensity: state.intensity
    });
  }
});
