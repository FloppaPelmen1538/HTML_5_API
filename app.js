const pages = {
  history: document.querySelector('#history-panel'),
  demo: document.querySelector('#demo-panel'),
};
const pageLinks = document.querySelectorAll('.page-links a');
const backButton = document.querySelector('#back');
const forwardButton = document.querySelector('#forward');
const historyPosition = document.querySelector('#history-position');
const navigationError = document.querySelector('#navigation-error');
const trailEnds = new Map();
let route;

function readTrailEnd(chain) {
  try {
    return Number(sessionStorage.getItem(`browser-api-6:${chain}`)) || 0;
  } catch {
    return 0;
  }
}

function showRoute() {
  for (const [page, panel] of Object.entries(pages)) {
    panel.hidden = page !== route.page;
  }

  for (const link of pageLinks) {
    if (link.hash === `#${route.page}`) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }

  const end = trailEnds.get(route.chain);
  backButton.disabled = route.index === 0;
  forwardButton.disabled = route.index === end;
  historyPosition.value = `${route.index + 1} из ${end + 1}`;
  syncCanvas();
}

function restoreRoute(state) {
  const page = location.hash === '#demo' ? 'demo' : 'history';
  navigationError.hidden = true;

  if (state?.chain && state.page === page) {
    route = state;
  } else {
    const chain = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    route = { page, chain, index: 0 };
    try {
      history.replaceState(route, '', `#${page}`);
    } catch {
      showNavigationError();
    }
  }

  const end = trailEnds.get(route.chain) ?? readTrailEnd(route.chain);
  trailEnds.set(route.chain, Math.max(route.index, end));
  showRoute();
}

function showNavigationError() {
  navigationError.textContent = 'Не удалось записать переход в историю.';
  navigationError.hidden = false;
}

for (const link of pageLinks) {
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const page = link.hash.slice(1);
    if (page === route.page) return;

    const next = { page, chain: route.chain, index: route.index + 1 };
    try {
      history.pushState(next, '', link.hash);
    } catch {
      showNavigationError();
      return;
    }

    route = next;
    trailEnds.set(route.chain, route.index);
    try {
      sessionStorage.setItem(`browser-api-6:${route.chain}`, route.index);
    } catch {
      // При закрытом хранилище граница остается в памяти страницы.
    }

    navigationError.hidden = true;
    showRoute();
  });
}

backButton.addEventListener('click', () => history.back());
forwardButton.addEventListener('click', () => history.forward());
window.addEventListener('popstate', ({ state }) => restoreRoute(state));
window.addEventListener('hashchange', () => {
  if (history.state?.chain !== route.chain || location.hash !== `#${route.page}`) {
    restoreRoute(history.state);
  }
});

function restoreInput(input) {
  try {
    const value = Number(localStorage.getItem(`browser-api-6:input:${input.id}`));
    if (Number.isInteger(value) && value >= Number(input.min) && value <= Number(input.max)) {
      input.value = value;
    }
  } catch {
    // Если хранилище недоступно, остаются значения из HTML.
  }
}

function saveInput(input) {
  try {
    localStorage.setItem(`browser-api-6:input:${input.id}`, input.value);
  } catch {}
}

const canvas = document.querySelector('#particles');
const context = canvas.getContext('2d');
const countInput = document.querySelector('#particle-count');
const countValue = document.querySelector('#particle-value');
const pauseButton = document.querySelector('#pause');
const saveImageButton = document.querySelector('#save-image');
const canvasStatus = document.querySelector('#canvas-status');
const fpsValue = document.querySelector('#fps');
const particles = [];
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let width = 0;
let height = 0;
let pointer = null;
let frameId = null;
let previousTime = null;
let fpsSince = 0;
let frames = 0;
let resizeTimer;

function canvasVisible() {
  return context !== null && !pages.demo.hidden && !document.hidden;
}

function updateParticleCount() {
  const count = countInput.valueAsNumber;
  particles.length = Math.min(particles.length, count);

  while (particles.length < count) {
    const radius = 1.7 + Math.random() * 1.7;
    const angle = Math.random() * Math.PI * 2;
    const speed = 24 + Math.random() * 28;
    particles.push({
      x: radius + Math.random() * (width - 2 * radius),
      y: radius + Math.random() * (height - 2 * radius),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      speed,
    });
  }
}

function resizeCanvas() {
  if (!canvasVisible()) return;

  const rect = canvas.getBoundingClientRect();
  if (width && height && (width !== rect.width || height !== rect.height)) {
    for (const particle of particles) {
      particle.x *= rect.width / width;
      particle.y *= rect.height / height;
    }
  }
  width = rect.width;
  height = rect.height;
  if (!width || !height) return;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  updateParticleCount();
  drawParticles();
}

function moveParticles(seconds) {
  const drag = Math.exp(-2.8 * seconds);
  for (const particle of particles) {
    if (pointer) {
      const dx = particle.x - pointer.x;
      const dy = particle.y - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < 90) {
        const push = 850 * (1 - distance / 90) * seconds / distance;
        particle.vx += dx * push;
        particle.vy += dy * push;
      }
    }

    const speed = Math.hypot(particle.vx, particle.vy);
    if (speed > particle.speed) {
      const slowed = particle.speed + (Math.min(speed, 220) - particle.speed) * drag;
      particle.vx *= slowed / speed;
      particle.vy *= slowed / speed;
    }

    const { radius } = particle;
    particle.x += particle.vx * seconds;
    particle.y += particle.vy * seconds;
    if (particle.x < radius) {
      particle.x = radius;
      particle.vx = Math.abs(particle.vx);
    } else if (particle.x > width - radius) {
      particle.x = width - radius;
      particle.vx = -Math.abs(particle.vx);
    }
    if (particle.y < radius) {
      particle.y = radius;
      particle.vy = Math.abs(particle.vy);
    } else if (particle.y > height - radius) {
      particle.y = height - radius;
      particle.vy = -Math.abs(particle.vy);
    }
  }
}

function drawParticles() {
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#3a678c';
  context.beginPath();
  for (const { x, y, radius } of particles) {
    context.moveTo(x + radius, y);
    context.arc(x, y, radius, 0, Math.PI * 2);
  }
  context.fill();
}

function animate(now) {
  if (previousTime === null) fpsSince = now;
  const seconds = previousTime === null ? 0 : Math.min((now - previousTime) / 1000, 0.04);
  previousTime = now;
  moveParticles(seconds);
  drawParticles();

  const elapsed = now - fpsSince;
  if (elapsed > 0) frames++;
  if (elapsed >= 750) {
    fpsValue.textContent = Math.round(frames * 1000 / elapsed);
    fpsSince = now;
    frames = 0;
  }
  frameId = requestAnimationFrame(animate);
}

function syncAnimation() {
  if (canvasVisible() && !paused) {
    if (frameId === null) frameId = requestAnimationFrame(animate);
    return;
  }

  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  previousTime = null;
  pointer = null;
  frames = 0;
  fpsValue.textContent = '-';
}

function syncCanvas() {
  resizeCanvas();
  syncAnimation();
}

function updatePointer(event) {
  if (paused || !event.isPrimary) return;
  const rect = canvas.getBoundingClientRect();
  pointer = {
    x: (event.clientX - rect.left) * width / rect.width,
    y: (event.clientY - rect.top) * height / rect.height,
  };
}

canvas.addEventListener('pointerdown', updatePointer);
canvas.addEventListener('pointermove', updatePointer);
canvas.addEventListener('pointerleave', () => { pointer = null; });
canvas.addEventListener('pointercancel', () => { pointer = null; });
canvas.addEventListener('pointerup', (event) => {
  if (event.pointerType !== 'mouse') pointer = null;
});

restoreInput(countInput);
countValue.value = countInput.value;
countInput.addEventListener('input', () => {
  countValue.value = countInput.value;
  if (canvasVisible()) {
    updateParticleCount();
    drawParticles();
  }
});
countInput.addEventListener('change', () => saveInput(countInput));

pauseButton.textContent = paused ? 'Продолжить' : 'Пауза';
pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Продолжить' : 'Пауза';
  syncAnimation();
});

saveImageButton.addEventListener('click', async () => {
  canvasStatus.textContent = '';
  canvasStatus.classList.remove('error');

  try {
    const image = document.createElement('canvas');
    image.width = canvas.width;
    image.height = canvas.height;
    const picture = image.getContext('2d');
    picture.fillStyle = getComputedStyle(canvas.parentElement).backgroundColor;
    picture.fillRect(0, 0, image.width, image.height);
    picture.drawImage(canvas, 0, 0);

    const blob = await new Promise((resolve) => image.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Не удалось закодировать PNG.');

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'particles.png';
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    link.click();
    canvasStatus.textContent = 'Снимок PNG готов.';
  } catch {
    canvasStatus.textContent = 'Не удалось подготовить PNG.';
    canvasStatus.classList.add('error');
  }
});

if (!context) {
  canvasStatus.textContent = 'Не удалось открыть холст.';
  canvasStatus.classList.add('error');
  countInput.disabled = true;
  pauseButton.disabled = true;
  saveImageButton.disabled = true;
}

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeCanvas, 120);
});
document.addEventListener('visibilitychange', syncCanvas);

const primeForm = document.querySelector('#prime-form');
const limitInput = document.querySelector('#prime-limit');
const calculateButton = document.querySelector('#calculate');
const stopButton = document.querySelector('#stop');
const workerStatus = document.querySelector('#worker-status');
const result = document.querySelector('#prime-result');
const primeCount = document.querySelector('#prime-count');
const largestPrime = document.querySelector('#largest-prime');
const numberFormat = new Intl.NumberFormat('ru-RU');
let worker = null;

restoreInput(limitInput);

function formatNumber(number) {
  return numberFormat.format(number).replace(/\s/g, ' ');
}

function setWorkerStatus(message, error = false) {
  workerStatus.textContent = message;
  workerStatus.classList.toggle('error', error);
}

function finishWorker(message, error = false) {
  worker?.terminate();
  worker = null;
  const returnFocus = document.activeElement === stopButton;
  limitInput.disabled = false;
  calculateButton.disabled = false;
  stopButton.hidden = true;
  setWorkerStatus(message, error);
  if (returnFocus) calculateButton.focus();
}

primeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (worker) return;

  const limit = limitInput.valueAsNumber;
  result.hidden = true;
  if (!Number.isInteger(limit) || limit < 2 || limit > 20_000_000) {
    limitInput.setAttribute('aria-invalid', 'true');
    setWorkerStatus('Введите целое число от 2 до 20 000 000.', true);
    limitInput.focus();
    return;
  }

  limitInput.removeAttribute('aria-invalid');
  try {
    const current = new Worker('./worker.js');
    worker = current;
    const moveFocus = primeForm.contains(document.activeElement);
    limitInput.disabled = true;
    calculateButton.disabled = true;
    stopButton.hidden = false;
    if (moveFocus) stopButton.focus();
    setWorkerStatus('Идет расчет...');

    current.onmessage = ({ data }) => {
      if (worker !== current) return;
      if (data.error) {
        finishWorker(data.error, true);
        return;
      }

      primeCount.textContent = formatNumber(data.count);
      largestPrime.textContent = formatNumber(data.largest);
      result.hidden = false;
      finishWorker(`Расчет завершен за ${formatNumber(data.elapsedMs)} мс.`);
    };

    current.onerror = (error) => {
      error.preventDefault();
      if (worker === current) finishWorker('Ошибка при работе воркера.', true);
    };

    current.postMessage({ limit });
    saveInput(limitInput);
  } catch {
    const message = location.protocol === 'file:'
      ? 'Откройте страницу через локальный сервер.'
      : 'Не удалось запустить воркер.';
    finishWorker(message, true);
  }
});

limitInput.addEventListener('input', () => {
  limitInput.removeAttribute('aria-invalid');
  result.hidden = true;
  setWorkerStatus('Готово к расчету.');
});

stopButton.addEventListener('click', () => finishWorker('Расчет остановлен.'));

restoreRoute(history.state);
