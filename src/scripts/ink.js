// Ink-in-water canvas for the hero: soft blots bloom and diffuse, occasional cinnabar drops,
// pointer movement seeds new ink. Low-res buffer + pause when offscreen keeps it cheap.
export function startInk(canvas, { reduce = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const SCALE = 0.5;
  let w = 0, h = 0, raf = 0, running = false, t = 0;
  const blots = [];

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = canvas.width = Math.max(1, Math.round(r.width * SCALE));
    h = canvas.height = Math.max(1, Math.round(r.height * SCALE));
  };

  const spawn = (x, y, opts = {}) => {
    blots.push({
      x: x ?? Math.random() * w,
      y: y ?? Math.random() * h,
      r: opts.r ?? 4 + Math.random() * 10,
      max: opts.max ?? (0.07 + Math.random() * 0.16) * Math.max(w, h),
      grow: opts.grow ?? 0.12 + Math.random() * 0.25,
      a: opts.a ?? 0.07 + Math.random() * 0.08,
      red: opts.red ?? Math.random() < 0.12,
      dx: (Math.random() - 0.5) * 0.08,
      dy: -0.02 - Math.random() * 0.06,
      wob: Math.random() * Math.PI * 2,
    });
    if (blots.length > 46) blots.shift();
  };

  const draw = () => {
    t += 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(16,14,11,0.06)'; // slow fade = diffusion trail
    ctx.fillRect(0, 0, w, h);
    for (const b of blots) {
      b.r += (b.max - b.r) * 0.004 * b.grow * 10;
      b.x += b.dx + Math.sin((t + b.wob * 60) / 90) * 0.05;
      b.y += b.dy;
      b.a *= 0.9975;
      const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.05, b.x, b.y, b.r);
      const c = b.red ? '196,48,36' : '232,220,196';
      const boost = b.red ? 2.2 : 1;
      g.addColorStop(0, `rgba(${c},${b.a * 0.55 * boost})`);
      g.addColorStop(0.45, `rgba(${c},${b.a * 0.22 * boost})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = blots.length - 1; i >= 0; i--) if (blots[i].a < 0.012) blots.splice(i, 1);
    if (t % 110 === 0) spawn();
    if (running) raf = requestAnimationFrame(draw);
  };

  const start = () => { if (!running && !reduce) { running = true; raf = requestAnimationFrame(draw); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  resize();
  for (let i = 0; i < 6; i++) spawn(undefined, undefined, { r: 10 + Math.random() * 30 });
  if (reduce) { for (let i = 0; i < 120; i++) { running = false; draw(); } return { stop }; }

  addEventListener('resize', resize);
  let last = 0;
  canvas.parentElement.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - last < 120) return;
    last = now;
    const r = canvas.getBoundingClientRect();
    spawn((e.clientX - r.left) * SCALE, (e.clientY - r.top) * SCALE, { r: 2, max: 30 + Math.random() * 40, a: 0.16 });
  }, { passive: true });
  new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop())).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  return { stop };
}
