import { gaussian, mulberry32 } from './random';

type Rgb = readonly [number, number, number];

interface Twinkle {
  x: number;
  y: number;
  r: number;
  alpha: number;
  speed: number;
  phase: number;
  color: string;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  length: number;
  life: number;
  width: number;
  head: string;
  tail: string;
  t0: number;
  dead: boolean;
}

interface Ripple {
  x: number;
  y: number;
  t0: number;
  sparks: { angle: number; dist: number }[];
  dead: boolean;
}

interface BornStar {
  x: number;
  y: number;
  r: number;
  color: string;
  t0: number;
  speed: number;
  phase: number;
  dead: boolean;
}

interface MeteorOptions {
  x?: number;
  y?: number;
  angle?: number;
  speed?: number;
  length?: number;
  life?: number;
  width?: number;
  warm?: boolean;
  delay?: number;
}

export interface SkyElements {
  readonly staticCanvas: HTMLCanvasElement;
  readonly fxCanvas: HTMLCanvasElement;
  readonly horizonCanvas: HTMLCanvasElement | null;
  readonly lantern: HTMLElement | null;
}

const COOL: readonly Rgb[] = [[70, 120, 210], [60, 150, 205], [95, 135, 230], [50, 105, 175]];
const VIOLET: readonly Rgb[] = [[105, 75, 185], [135, 85, 190], [85, 70, 165], [70, 90, 190]];
const WARM: readonly Rgb[] = [[255, 186, 128], [236, 150, 112], [255, 206, 160], [214, 132, 124]];
const STAR_WARM_WHITE = '255,246,234';
const STAR_BLUE = '200,216,255';
const STAR_GOLD = '255,222,180';
const BORN_LIFE = 10;
const RIPPLE_LIFE = 1.4;

const seconds = () => performance.now() / 1000;
const pick = <T>(list: readonly T[], rnd: () => number): T => list[Math.floor(rnd() * list.length)] as T;
const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(4)})`;

function readAccent(): string {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--lamp').trim().replace('#', '');
  const n = Number.parseInt(hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6), 16);
  return Number.isNaN(n) ? '246,193,107' : `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export class Sky {
  private width = 0;
  private height = 0;
  private skyWidth = 0;
  private skyHeight = 0;
  private margin = 64;
  private horizonWidth = 0;
  private horizonHeight = 0;
  private horizonVisible = 0;
  private dpr = 1;
  private fxDpr = 1;
  private pivot = { x: 0, y: 0 };
  private staticCtx: CanvasRenderingContext2D | null = null;
  private fxCtx: CanvasRenderingContext2D | null = null;
  private horizonCtx: CanvasRenderingContext2D | null = null;
  private twinkles: Twinkle[] = [];
  private meteors: Meteor[] = [];
  private ripples: Ripple[] = [];
  private born: BornStar[] = [];
  private readonly t0 = seconds();
  private nextMeteor = this.t0 + 2.8;
  private firstMeteor = true;
  private readonly par = { x: 0, y: 0 };
  private shift = { x: 0, y: 0 };
  private theta = 0;
  private pointer: { x: number; y: number } | null = null;
  private readonly lanternPos = { x: 0, y: 0 };
  private readonly reduced: boolean;
  private mobile = false;
  private readonly accent: string;
  private paintedWidth = 0;
  private paintedHeight = 0;
  private resizeTimer = 0;

  constructor(
    private readonly el: SkyElements,
    private readonly meteorEvery = 6,
  ) {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.accent = readAccent();
  }

  start(): void {
    this.layout(true);
    window.addEventListener('resize', () => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.layout(false), 150);
    });
    requestAnimationFrame(this.frame);
  }

  pointerMove(x: number, y: number): void {
    const entering = !this.pointer;
    this.pointer = { x, y };
    const lantern = this.el.lantern;
    if (entering && lantern && !this.mobile) {
      this.lanternPos.x = x;
      this.lanternPos.y = y;
      this.placeLantern();
      lantern.style.opacity = '1';
    }
  }

  pointerLeave(): void {
    this.pointer = null;
    if (this.el.lantern) this.el.lantern.style.opacity = '0';
  }

  ripple(x: number, y: number): void {
    const sparks = Array.from({ length: 8 }, () => ({ angle: Math.random() * Math.PI * 2, dist: 18 + Math.random() * 46 }));
    this.ripples.push({ x, y, t0: seconds(), sparks, dead: false });
    if (this.ripples.length > 12) this.ripples.shift();
  }

  birth(): void {
    const rnd = Math.random;
    const spread = Math.min(this.skyWidth, this.skyHeight) * (this.mobile ? 0.5 : 0.35);
    const p = rnd() < 0.6 ? this.bandPoint(rnd(), (rnd() - 0.5) * spread) : { x: rnd() * this.skyWidth, y: rnd() * this.skyHeight };
    const k = rnd();
    this.born.push({
      x: p.x - this.margin + this.shift.x,
      y: Math.min(this.height - (this.mobile ? 110 : 70), p.y - this.margin + this.shift.y),
      r: 0.9 + rnd() * 1.1,
      color: k < 0.5 ? STAR_GOLD : k < 0.85 ? STAR_WARM_WHITE : STAR_BLUE,
      t0: seconds(),
      speed: 1 + rnd() * 2,
      phase: rnd() * Math.PI * 2,
      dead: false,
    });
    if (this.born.length > 80) this.born.shift();
  }

  shower(): void {
    const t = seconds();
    for (let i = 0; i < 6; i++) this.spawnMeteor(t, { delay: i * 0.2 + Math.random() * 0.12 });
  }

  private readonly frame = (): void => {
    const t = seconds();
    if (!this.reduced && t >= this.nextMeteor) {
      if (this.firstMeteor) {
        this.firstMeteor = false;
        this.spawnMeteor(
          t,
          this.mobile
            ? { x: this.width * 0.95, y: this.height * 0.05, angle: 126, speed: 480, length: 190, life: 1.4, width: 1.5, warm: false }
            : { x: this.width * 0.8, y: this.height * 0.05, angle: 150, speed: 640, length: 300, life: 1.5, width: 1.6, warm: false },
        );
      } else {
        this.spawnMeteor(t);
        if (Math.random() < 0.12) this.spawnMeteor(t, { delay: 0.25 + Math.random() * 0.4 });
      }
      this.nextMeteor = t + this.meteorEvery * (0.4 + Math.random() * 1.2);
    }
    this.applyMotion(t, false);
    this.draw(t);
    requestAnimationFrame(this.frame);
  };

  private layout(force: boolean): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.mobile = w < 768;
    this.sizeFx();
    // Mobile browsers resize the viewport as the URL bar slides; the sky margin absorbs that without a repaint.
    const repaint = force || w !== this.paintedWidth || h > this.paintedHeight + this.margin * 0.8 || h < this.paintedHeight - 200;
    if (repaint) {
      this.paintedWidth = w;
      this.paintedHeight = h;
      this.margin = Math.max(64, Math.round(Math.max(w, h) * 0.05));
      this.skyWidth = w + 2 * this.margin;
      this.skyHeight = h + 2 * this.margin;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(12e6 / (this.skyWidth * this.skyHeight)));
      const canvas = this.el.staticCanvas;
      canvas.width = Math.round(this.skyWidth * this.dpr);
      canvas.height = Math.round(this.skyHeight * this.dpr);
      canvas.style.left = `${-this.margin}px`;
      canvas.style.top = `${-this.margin}px`;
      canvas.style.width = `${this.skyWidth}px`;
      canvas.style.height = `${this.skyHeight}px`;
      this.pivot = { x: this.skyWidth / 2, y: this.skyHeight * 2.2 };
      canvas.style.transformOrigin = `${this.pivot.x}px ${this.pivot.y}px`;
      this.staticCtx = canvas.getContext('2d');
      this.paintSky();
      this.layoutHorizon();
      this.seedTwinkles();
    }
    const t = seconds();
    this.applyMotion(t, true);
    this.draw(t);
  }

  private sizeFx(): void {
    const canvas = this.el.fxCanvas;
    this.fxDpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6e6 / Math.max(1, this.width * this.height)));
    canvas.width = Math.round(this.width * this.fxDpr);
    canvas.height = Math.round(this.height * this.fxDpr);
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;
    this.fxCtx = canvas.getContext('2d');
  }

  private layoutHorizon(): void {
    const canvas = this.el.horizonCanvas;
    if (!canvas) return;
    this.horizonVisible = this.mobile ? 230 : 290;
    this.horizonWidth = this.width + 80;
    this.horizonHeight = this.horizonVisible + 40;
    canvas.width = Math.round(this.horizonWidth * this.dpr);
    canvas.height = Math.round(this.horizonHeight * this.dpr);
    canvas.style.width = `${this.horizonWidth}px`;
    canvas.style.height = `${this.horizonHeight}px`;
    this.horizonCtx = canvas.getContext('2d');
    this.paintHorizon();
  }

  private bandPoint(s: number, offset: number): { x: number; y: number } {
    const W = this.skyWidth;
    const H = this.skyHeight;
    const x0 = (this.mobile ? -0.1 : -0.08) * W;
    const y0 = (this.mobile ? 0.9 : 0.95) * H;
    const x1 = (this.mobile ? 1.1 : 1.08) * W;
    const y1 = (this.mobile ? 0.12 : 0.08) * H;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    return { x: x0 + dx * s + (-dy / len) * offset, y: y0 + dy * s + (dx / len) * offset };
  }

  private paintSky(): void {
    const ctx = this.staticCtx;
    if (!ctx) return;
    const W = this.skyWidth;
    const H = this.skyHeight;
    const S = Math.min(W, H);
    const rnd = mulberry32(20191101);
    const band = (s: number) => S * (this.mobile ? 0.2 + 0.14 * Math.sin(Math.PI * s) : 0.13 + 0.09 * Math.sin(Math.PI * s));

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#04040b');
    bg.addColorStop(0.5, '#070a1c');
    bg.addColorStop(1, '#06040b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    const clouds = this.mobile ? 80 : 104;
    for (let i = 0; i < clouds; i++) {
      const s = rnd();
      const p = this.bandPoint(s, gaussian(rnd) * band(s) * 0.45);
      const radius = S * (this.mobile ? 0.1 + rnd() * 0.35 : 0.05 + rnd() * 0.2) * (0.7 + 0.6 * Math.sin(Math.PI * s));
      const warmChance = Math.max(0, 1 - s / 0.42) * 0.85;
      let color: Rgb;
      let alpha: number;
      if (rnd() < warmChance) {
        color = pick(WARM, rnd);
        alpha = (0.01 + rnd() * 0.026) * 0.9;
      } else {
        color = pick(rnd() < 0.35 + 0.5 * s ? COOL : VIOLET, rnd);
        const core = Math.exp(-(((s - 0.62) / 0.16) ** 2));
        alpha = (0.012 + rnd() * 0.03) * (0.6 + 1.1 * core);
      }
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }

    ctx.globalCompositeOperation = 'source-over';
    const lanes = this.mobile ? 28 : 40;
    for (let i = 0; i < lanes; i++) {
      const s = rnd() < 0.45 ? rnd() * 0.45 : 0.1 + rnd() * 0.85;
      const p = this.bandPoint(s, gaussian(rnd) * band(s) * 0.18);
      const radius = S * (this.mobile ? 0.04 + rnd() * 0.12 : 0.02 + rnd() * 0.07);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      g.addColorStop(0, `rgba(3,2,9,${(0.18 + rnd() * 0.3).toFixed(3)})`);
      g.addColorStop(1, 'rgba(3,2,9,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }

    const tint = () => {
      const k = rnd();
      return k < 0.62 ? STAR_WARM_WHITE : k < 0.8 ? STAR_BLUE : STAR_GOLD;
    };
    const field = Math.round((W * H) / (this.mobile ? 520 : 620));
    for (let i = 0; i < field; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 0.22 + rnd() ** 3 * 1.05;
      ctx.fillStyle = `rgba(${tint()},${(0.3 + rnd() * 0.6).toFixed(3)})`;
      if (r < 0.55) {
        ctx.fillRect(x, y, r * 2, r * 2);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const dense = Math.round((W * H) / (this.mobile ? 240 : 260));
    for (let i = 0; i < dense; i++) {
      const s = rnd();
      const p = this.bandPoint(s, gaussian(rnd) * band(s) * 0.5);
      const r = 0.2 + rnd() ** 4 * 0.9;
      ctx.fillStyle = `rgba(${tint()},${(0.25 + rnd() * 0.55).toFixed(3)})`;
      ctx.fillRect(p.x, p.y, r * 2, r * 2);
    }
    const bright = Math.round((W * H) / 30000);
    for (let i = 0; i < bright; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 0.9 + rnd() * 1.1;
      const c = tint();
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
      g.addColorStop(0, `rgba(${c},0.5)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
      ctx.fillStyle = `rgba(${c},0.95)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const grain = document.createElement('canvas');
    grain.width = 128;
    grain.height = 128;
    const gctx = grain.getContext('2d');
    if (gctx) {
      const img = gctx.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(rnd() * 255);
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 7;
      }
      gctx.putImageData(img, 0, 0);
      const pattern = ctx.createPattern(grain, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, W, H);
      }
    }

    const vignette = ctx.createRadialGradient(W * 0.55, H * 0.45, S * 0.35, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(2,1,6,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  private paintHorizon(): void {
    const ctx = this.horizonCtx;
    if (!ctx) return;
    const HW = this.horizonWidth;
    const HH = this.horizonHeight;
    const R = this.mobile ? Math.max(700, this.width * 1.8) : Math.max(2600, this.width * 2.1);
    const cx = HW * (this.mobile ? 0.5 : 0.56);
    const peak = this.horizonVisible - (this.mobile ? 96 : 46);
    const cy = peak + R;
    const sunX = HW * 0.8;
    const glowReach = this.mobile ? 90 : 120;
    const limbY = (x: number) => cy - Math.sqrt(Math.max(0, R * R - (x - cx) * (x - cx)));

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, HW, HH);

    const ring = ctx.createRadialGradient(cx, cy, R - 2, cx, cy, R + glowReach);
    ring.addColorStop(0, 'rgba(255,186,120,0.42)');
    ring.addColorStop(0.09, 'rgba(255,140,120,0.2)');
    ring.addColorStop(0.32, 'rgba(120,110,230,0.08)');
    ring.addColorStop(1, 'rgba(60,80,200,0)');
    ctx.fillStyle = ring;
    ctx.fillRect(0, 0, HW, HH);
    ctx.globalCompositeOperation = 'destination-in';
    const falloff = ctx.createLinearGradient(0, 0, HW, 0);
    falloff.addColorStop(0, 'rgba(0,0,0,0.25)');
    falloff.addColorStop(0.45, 'rgba(0,0,0,0.55)');
    falloff.addColorStop(0.8, 'rgba(0,0,0,1)');
    falloff.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = falloff;
    ctx.fillRect(0, 0, HW, HH);
    ctx.globalCompositeOperation = 'source-over';

    const body = ctx.createLinearGradient(0, peak, 0, HH);
    body.addColorStop(0, '#0e0b17');
    body.addColorStop(0.25, '#07060d');
    body.addColorStop(1, '#030206');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    const limb = ctx.createLinearGradient(0, 0, HW, 0);
    limb.addColorStop(0, 'rgba(255,196,150,0.1)');
    limb.addColorStop(0.5, 'rgba(255,200,150,0.35)');
    limb.addColorStop(0.8, 'rgba(255,226,180,0.95)');
    limb.addColorStop(1, 'rgba(255,200,150,0.4)');
    ctx.strokeStyle = limb;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI * 1.5 - 0.45, Math.PI * 1.5 + 0.45);
    ctx.stroke();

    const rnd = mulberry32(4242);
    const clusters = Math.max(5, Math.round(this.width / 144));
    for (let k = 0; k < clusters; k++) {
      const clusterX = HW * (0.1 + rnd() * 0.82);
      const glowY = limbY(clusterX) + 14;
      const cg = ctx.createRadialGradient(clusterX, glowY, 0, clusterX, glowY, 34);
      cg.addColorStop(0, 'rgba(255,180,110,0.07)');
      cg.addColorStop(1, 'rgba(255,180,110,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(clusterX - 34, glowY - 34, 68, 68);
      const count = 5 + Math.floor(rnd() * 10);
      for (let i = 0; i < count; i++) {
        const x = clusterX + (rnd() - 0.5) * 64;
        const depth = 5 + rnd() ** 1.6 * 34;
        const y = limbY(x) + depth;
        if (y > this.horizonVisible + 6) continue;
        const r = 0.5 + rnd() * 0.8;
        const a = (0.35 + rnd() * 0.55) * (1 - depth / 48);
        ctx.fillStyle = `rgba(255,${180 + Math.floor(rnd() * 40)},${100 + Math.floor(rnd() * 50)},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const sunY = limbY(sunX);
    const bloom = this.mobile ? 150 : 260;
    ctx.globalCompositeOperation = 'lighter';
    const b1 = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, bloom);
    b1.addColorStop(0, 'rgba(255,190,130,0.24)');
    b1.addColorStop(0.35, 'rgba(255,150,110,0.08)');
    b1.addColorStop(1, 'rgba(255,140,100,0)');
    ctx.fillStyle = b1;
    ctx.fillRect(sunX - bloom, sunY - bloom, bloom * 2, bloom * 2);
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.scale(this.mobile ? 4 : 5, 1);
    const flare = this.mobile ? 24 : 36;
    const b2 = ctx.createRadialGradient(0, 0, 0, 0, 0, flare);
    b2.addColorStop(0, 'rgba(255,236,210,0.38)');
    b2.addColorStop(1, 'rgba(255,220,180,0)');
    ctx.fillStyle = b2;
    ctx.fillRect(-flare, -flare, flare * 2, flare * 2);
    ctx.restore();
    const b3 = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 10);
    b3.addColorStop(0, 'rgba(255,250,240,0.7)');
    b3.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = b3;
    ctx.fillRect(sunX - 10, sunY - 10, 20, 20);
    ctx.globalCompositeOperation = 'source-over';
  }

  private seedTwinkles(): void {
    const rnd = mulberry32(777);
    const W = this.skyWidth;
    const H = this.skyHeight;
    const count = Math.round((W * H) / (this.mobile ? 5200 : 11500));
    this.twinkles = Array.from({ length: count }, () => {
      const p = rnd() < 0.5 ? this.bandPoint(rnd(), (rnd() - 0.5) * Math.min(W, H) * (this.mobile ? 0.5 : 0.3)) : { x: rnd() * W, y: rnd() * H };
      return {
        x: p.x,
        y: p.y,
        r: 0.6 + rnd() * 1.1,
        alpha: 0.35 + rnd() * 0.55,
        speed: 0.25 + rnd() * 0.85,
        phase: rnd() * Math.PI * 2,
        color: rnd() < 0.8 ? '255,244,228' : '205,220,255',
      };
    });
  }

  private spawnMeteor(t: number, o: MeteorOptions = {}): void {
    const angle = ((o.angle ?? (this.mobile ? 115 + Math.random() * 25 : 142 + Math.random() * 22)) * Math.PI) / 180;
    const warm = o.warm ?? Math.random() < 0.22;
    const meteor: Meteor = {
      x: o.x ?? this.width * (0.3 + Math.random() * 0.8),
      y: o.y ?? this.height * (-0.05 + Math.random() * (this.mobile ? 0.35 : 0.4)),
      vx: Math.cos(angle),
      vy: Math.sin(angle),
      speed: o.speed ?? (this.mobile ? 380 + Math.random() * 300 : 520 + Math.random() * 460),
      length: o.length ?? (this.mobile ? 90 + Math.random() * 90 : 150 + Math.random() * 190),
      life: o.life ?? (this.mobile ? 0.8 + Math.random() * 0.6 : 0.85 + Math.random() * 0.7),
      width: o.width ?? 1.1 + Math.random() * 0.7,
      head: warm ? '255,228,196' : '255,255,255',
      tail: warm ? '255,190,140' : '200,225,255',
      t0: t + (o.delay ?? 0),
      dead: false,
    };
    if (o.x === undefined && Math.random() < 0.1) {
      meteor.length *= 1.6;
      meteor.width *= 1.4;
      meteor.life *= 1.3;
    }
    this.meteors.push(meteor);
  }

  private applyMotion(t: number, immediate: boolean): void {
    let tx = 0;
    let ty = 0;
    if (!this.reduced) {
      if (this.pointer) {
        tx = -(this.pointer.x / this.width - 0.5) * 2;
        ty = -(this.pointer.y / this.height - 0.5) * 2;
      }
      tx += Math.sin(t / 19) * (this.mobile ? 0.35 : 0.22);
      ty += Math.cos(t / 23) * (this.mobile ? 0.25 : 0.16);
    }
    const ease = immediate ? 1 : 0.035;
    this.par.x += (tx - this.par.x) * ease;
    this.par.y += (ty - this.par.y) * ease;
    this.theta = this.reduced ? 0 : (this.mobile ? 0.018 : 0.021) * Math.sin((2 * Math.PI * t) / 240);
    const amplitude = this.mobile ? 10 : 14;
    this.shift = { x: this.par.x * amplitude, y: this.par.y * amplitude };
    this.el.staticCanvas.style.transform = `translate(${this.shift.x.toFixed(2)}px, ${this.shift.y.toFixed(2)}px) rotate(${this.theta.toFixed(5)}rad)`;
    if (this.el.horizonCanvas) {
      const hx = this.par.x * (this.mobile ? 16 : 26);
      const hy = this.par.y * (this.mobile ? 10 : 16);
      this.el.horizonCanvas.style.transform = `translate(${hx.toFixed(2)}px, ${hy.toFixed(2)}px)`;
    }
    if (this.pointer && this.el.lantern) {
      const follow = immediate ? 1 : 0.14;
      this.lanternPos.x += (this.pointer.x - this.lanternPos.x) * follow;
      this.lanternPos.y += (this.pointer.y - this.lanternPos.y) * follow;
      this.placeLantern();
    }
  }

  private placeLantern(): void {
    if (this.el.lantern) this.el.lantern.style.transform = `translate(${this.lanternPos.x.toFixed(1)}px, ${this.lanternPos.y.toFixed(1)}px)`;
  }

  private draw(t: number): void {
    const ctx = this.fxCtx;
    if (!ctx) return;
    const dawn = Math.min(1, Math.max(0, (t - this.t0) / 3));
    ctx.setTransform(this.fxDpr, 0, 0, this.fxDpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(-this.margin + this.pivot.x + this.shift.x, -this.margin + this.pivot.y + this.shift.y);
    ctx.rotate(this.theta);
    ctx.translate(-this.pivot.x, -this.pivot.y);
    for (const star of this.twinkles) {
      const wave = this.reduced ? 0.8 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase));
      const a = star.alpha * wave * dawn;
      if (a <= 0.003) continue;
      if (star.r > 1.2) {
        const g = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r * 4);
        g.addColorStop(0, `rgba(${star.color},${(a * 0.35).toFixed(3)})`);
        g.addColorStop(1, `rgba(${star.color},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(star.x - star.r * 4, star.y - star.r * 4, star.r * 8, star.r * 8);
      }
      ctx.fillStyle = `rgba(${star.color},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const b of this.born) {
      const age = t - b.t0;
      if (age > BORN_LIFE) {
        b.dead = true;
        continue;
      }
      const a = Math.min(1, age / 0.35) * (age > BORN_LIFE - 3.5 ? (BORN_LIFE - age) / 3.5 : 1) * (0.75 + 0.25 * Math.sin(age * b.speed + b.phase));
      if (age < 0.7) {
        const k = age / 0.7;
        const arm = 11 * (1 - k) + 3;
        ctx.strokeStyle = `rgba(${b.color},${(0.8 * (1 - k)).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x - arm, b.y);
        ctx.lineTo(b.x + arm, b.y);
        ctx.moveTo(b.x, b.y - arm);
        ctx.lineTo(b.x, b.y + arm);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 6);
      g.addColorStop(0, `rgba(${b.color},${(0.55 * a).toFixed(3)})`);
      g.addColorStop(1, `rgba(${b.color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(b.x - b.r * 6, b.y - b.r * 6, b.r * 12, b.r * 12);
      ctx.fillStyle = `rgba(${b.color},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const m of this.meteors) {
      const age = t - m.t0;
      if (age < 0) continue;
      const k = age / m.life;
      if (k > 1) {
        m.dead = true;
        continue;
      }
      const hx = m.x + m.vx * m.speed * age;
      const hy = m.y + m.vy * m.speed * age;
      const fade = k < 0.15 ? k / 0.15 : k > 0.6 ? Math.max(0, (1 - k) / 0.4) : 1;
      const tail = m.length * (0.35 + 0.65 * Math.min(1, k * 3));
      const g = ctx.createLinearGradient(hx, hy, hx - m.vx * tail, hy - m.vy * tail);
      g.addColorStop(0, `rgba(${m.head},${(0.95 * fade).toFixed(3)})`);
      g.addColorStop(0.25, `rgba(${m.tail},${(0.42 * fade).toFixed(3)})`);
      g.addColorStop(1, `rgba(${m.tail},0)`);
      ctx.strokeStyle = g;
      ctx.lineCap = 'round';
      ctx.lineWidth = m.width;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - m.vx * tail, hy - m.vy * tail);
      ctx.stroke();
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = m.width * 3.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const headRadius = 5 + m.width * 2;
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, headRadius);
      hg.addColorStop(0, `rgba(${m.head},${(0.9 * fade).toFixed(3)})`);
      hg.addColorStop(1, `rgba(${m.head},0)`);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const r of this.ripples) {
      const k = (t - r.t0) / RIPPLE_LIFE;
      if (k >= 1) {
        r.dead = true;
        continue;
      }
      const e = 1 - (1 - k) ** 3;
      const reach = this.mobile ? 90 : 120;
      ctx.strokeStyle = `rgba(143,216,255,${(0.5 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + e * reach, 0, Math.PI * 2);
      ctx.stroke();
      if (k > 0.1) {
        const k2 = (k - 0.1) / 0.9;
        const e2 = 1 - (1 - k2) ** 3;
        ctx.strokeStyle = `rgba(${this.accent},${(0.45 * (1 - k2)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 4 + e2 * reach * 0.58, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,240,222,${(0.85 * (1 - k)).toFixed(3)})`;
      for (const spark of r.sparks) {
        const d = e * spark.dist;
        ctx.fillRect(r.x + Math.cos(spark.angle) * d - 0.8, r.y + Math.sin(spark.angle) * d - 0.8, 1.6, 1.6);
      }
    }

    if (this.meteors.some((m) => m.dead)) this.meteors = this.meteors.filter((m) => !m.dead);
    if (this.ripples.some((r) => r.dead)) this.ripples = this.ripples.filter((r) => !r.dead);
    if (this.born.some((b) => b.dead)) this.born = this.born.filter((b) => !b.dead);
  }
}
