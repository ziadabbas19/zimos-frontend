import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Water on the dock (PlaceDock), after the owner's reference (21st.dev
 * "Liquid Navbar — Waterline", by guglielmogiannattasio.it, 2026-11-15).
 *
 * A drop of water sits under the place you are in. Going to another place
 * stretches it toward the new tile; on a long jump it breaks into droplets
 * that run after it and merge back with a ripple. Every press sends a ripple
 * through the dock, the pointer lifts a little swell, and while the pointer
 * is over the dock the water moves. The dock's own rim catches the light.
 *
 * Drawn by a small WebGL shader on a canvas behind the tiles (only inside the
 * dock's box). Unlike the reference it never runs at rest: frames are drawn
 * only while something moves, so an idle dock costs nothing. Without WebGL a
 * plain CSS drop stands in; with reduced motion the drop simply moves.
 */

/** Canvas bleed around the dock, for the rim light and the ripples. */
const PAD = 14;
/** How much bigger than the tile the drop is, on each side. */
const GROW = 6;

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FRAG = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uPill;uniform float uPillR;
uniform vec4 uBlob[6];uniform float uSy[6];uniform vec4 uRip[6];uniform vec3 uMouse;uniform float uDark;uniform float uAmb;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float sdCap(vec2 p,vec4 B,float sy){p-=B.xy;p.y/=sy;p.x=max(abs(p.x)-B.z,0.);return(length(p)-B.w)*min(1.,sy);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;for(int i=0;i<6;i++){if(uBlob[i].w>.5){d=smin(d,sdCap(p,uBlob[i],uSy[i]),13.);}}return d;}
float pillD(vec2 p){vec2 h=uPill.zw*.5;return sdRB(p-uPill.xy-h,h,uPillR);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;
 for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1000.);
 w+=uAmb*(sin(p.x*.05+uTime*1.2)*.45+sin(p.x*.13-uTime*.85+p.y*.2)*.25);return w;}
float H(vec2 p){float dp=pillD(p);return lens(dp,min(uPillR,uPill.w*.36))*2.4+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,7.,-dp);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 float dp=pillD(p);float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));
 vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);
 float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);
 vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.85+p.x*.0028+uTime*.035));
 float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);
 float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*(.11+.07*uDark);
 vec3 c=vec3(0.,.14,.36)*sh;float a=sh;
 float pa=clamp(pm*(fres*.5+spec*.9+spec2),0.,1.);
 c=mix(vec3(1.),irid,.5*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);
 float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);
 vec3 tint=mix(vec3(.80,.95,1.),vec3(.55,.82,1.),uDark);
 float rim=dm*(1.-smoothstep(0.,8.,-dd));
 float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);
 float da=dm*(.26+.14*body)*(1.-.35*uDark);vec3 dc=mix(tint,vec3(1.),body*.6);
 float la=rim*.22;vec3 lc=mix(vec3(0.,.42,.78),vec3(.1,.55,.95),uDark);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.7+smoothstep(.6,1.,cs)*.28*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.4;dc=mix(vec3(1.),irid,.35)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);
 gl_FragColor=vec4(c,a);
}`;

type Body = { x: number; v: number };
type Satellite = { x: number; y: number; vx: number; vy: number; r: number; k: number };
type Ripple = { x: number; y: number; age: number; amp: number };
type GL = { gl: WebGLRenderingContext; u: Record<string, WebGLUniformLocation | null> };

function makeState() {
  return {
    a: { x: 0, v: 0 } as Body,
    b: { x: 0, v: 0 } as Body,
    sy: { s: 1, v: 0 },
    lead: 0 as 0 | 1,
    lagFrom: 0,
    sats: [] as Satellite[],
    rips: [] as Ripple[],
    t: { x: 0, cy: 0, q: 0, r: 24 },
    q: 0,
    mouse: { x: 0, y: 0, s: 0, on: false },
    moving: false,
    split: false,
    ready: false,
    has: false,
    w: 0,
    h: 0,
    radius: 20,
    visible: true,
    reduce: false,
    raf: 0,
    last: 0,
    time: 0,
    glc: null as GL | null,
  };
}

function initGL(canvas: HTMLCanvasElement): GL | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const name of ["uRes", "uDpr", "uTime", "uPill", "uPillR", "uBlob", "uSy", "uRip", "uMouse", "uDark", "uAmb"]) {
    u[name] = gl.getUniformLocation(program, name);
  }
  return { gl, u };
}

/** Where an element sits inside the dock, ignoring its hover lift (offsets skip transforms). */
function offsetIn(el: HTMLElement, container: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== container) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/**
 * The water layer. `container` is the dock's list (positioned, and a stacking
 * context: the canvas lies between its glass and its tiles); `target` finds
 * the tile of the place you are in, null when you are in none; `current`
 * changes whenever that place does.
 */
export function LiquidDrop({
  container,
  target,
  current,
}: {
  container: RefObject<HTMLElement | null>;
  target: () => HTMLElement | null;
  current: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropRef = useRef<HTMLSpanElement>(null);
  const st = useRef(makeState());
  const targetRef = useRef(target);
  useLayoutEffect(() => {
    targetRef.current = target;
  });

  /* ---- drawing ---- */
  const draw = () => {
    const s = st.current;
    const T = s.t;
    const sep = Math.abs(s.a.x - s.b.x);
    const thin = Math.min(sep / (2 * (s.q + T.r) || 1), 1);
    if (s.glc) {
      const { gl, u } = s.glc;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(u.uRes, s.w + PAD * 2, s.h + PAD * 2);
      gl.uniform1f(u.uDpr, dpr);
      gl.uniform1f(u.uTime, s.time);
      gl.uniform4f(u.uPill, PAD, PAD, s.w, s.h);
      gl.uniform1f(u.uPillR, s.radius);
      const blobs = new Float32Array(24);
      const sy = new Float32Array(6).fill(1);
      if (s.has) {
        const head = s.lead === 0 ? s.a : s.b;
        const tail = s.lead === 0 ? s.b : s.a;
        blobs.set([head.x, T.cy, s.q * (1 - 0.25 * thin), T.r * (1 - 0.12 * thin), tail.x, T.cy, s.q * (1 - 0.8 * thin), T.r * (1 - 0.5 * thin)], 0);
        sy[0] = sy[1] = s.sy.s;
        s.sats.slice(0, 4).forEach((d, i) => blobs.set([d.x, d.y, 0, d.r], 8 + i * 4));
      }
      gl.uniform4fv(u.uBlob, blobs);
      gl.uniform1fv(u.uSy, sy);
      const rips = new Float32Array(24);
      s.rips.slice(-6).forEach((p, i) => rips.set([p.x, p.y, p.age, p.amp], i * 4));
      gl.uniform4fv(u.uRip, rips);
      gl.uniform3f(u.uMouse, s.mouse.x, s.mouse.y, s.mouse.s);
      gl.uniform1f(u.uDark, document.documentElement.classList.contains("dark") ? 1 : 0);
      gl.uniform1f(u.uAmb, s.reduce ? 0 : s.mouse.s);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (dropRef.current) {
      const r = T.r * (1 - 0.3 * thin);
      const left = Math.min(s.a.x, s.b.x) - s.q - r - PAD;
      dropRef.current.style.opacity = s.has ? "1" : "0";
      dropRef.current.style.top = `${T.cy - PAD - T.r}px`;
      dropRef.current.style.height = `${T.r * 2}px`;
      dropRef.current.style.width = `${sep + 2 * (s.q + r)}px`;
      dropRef.current.style.transform = `translateX(${left}px) scaleY(${s.sy.s})`;
    }
  };

  /* ---- physics (the reference's springs, unchanged) ---- */
  const step = (dt: number, now: number) => {
    const s = st.current;
    const T = s.t;
    s.time += dt;
    s.q += (T.q - s.q) * Math.min(1, dt * 12);
    const bodies = [s.a, s.b];
    let still = true;
    if (s.reduce) {
      s.a.x = s.b.x = T.x;
      s.a.v = s.b.v = 0;
      s.sy.s = 1;
      s.sats = [];
    } else {
      bodies.forEach((body, i) => {
        const lead = i === s.lead;
        const k = lead ? 210 : 72;
        const c = lead ? 25 : 13;
        const f = !lead && now < s.lagFrom ? 0.08 : 1;
        body.v += (k * (T.x - body.x) - c * body.v) * dt * f;
        body.x += body.v * dt;
        const lo = PAD + 6 + s.q + T.r - 3;
        const hi = PAD + s.w - 6 - s.q - T.r + 3;
        if (body.x < lo || body.x > hi) {
          s.sy.v -= Math.min(Math.abs(body.v), 900) * 0.0016;
          body.x = Math.max(lo, Math.min(hi, body.x));
          body.v *= -0.25;
        }
        if (Math.abs(T.x - body.x) > 0.3 || Math.abs(body.v) > 3) still = false;
      });
      const lead = bodies[s.lead];
      const squash = 1 - 0.2 * Math.min(Math.abs(lead.v) / 1500, 1);
      s.sy.v += (280 * (squash - s.sy.s) - 9 * s.sy.v) * dt;
      s.sy.s += s.sy.v * dt;
      if (Math.abs(s.sy.s - 1) > 0.002 || Math.abs(s.sy.v) > 0.02) still = false;
      // The neck breaks on a long jump: droplets between head and tail.
      const sep = Math.abs(s.a.x - s.b.x);
      const r = T.r * (1 - 0.3 * Math.min(sep / (2 * (T.q + T.r) || 1), 1));
      if (!s.split && s.moving && sep - 2 * T.q - 2 * r > -6) {
        s.split = true;
        const from = bodies[1 - s.lead];
        const to = bodies[s.lead];
        [0.3, 0.5, 0.72].forEach((t, j) => {
          s.sats.push({
            x: from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 6,
            y: T.cy + (Math.random() - 0.5) * 10,
            vx: (from.v + to.v) * 0.45,
            vy: (Math.random() - 0.5) * 60,
            r: 5 + Math.random() * 3 - j * 0.5,
            k: 70 + Math.random() * 90,
          });
        });
      }
      s.sats = s.sats.filter((d) => {
        d.vx += (d.k * (T.x - d.x) - 9 * d.vx) * dt;
        d.vy += (90 * (T.cy - d.y) - 7 * d.vy) * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.x = Math.max(PAD + 8 + d.r, Math.min(PAD + s.w - 8 - d.r, d.x));
        d.y = Math.max(T.cy - T.r + d.r, Math.min(T.cy + T.r - d.r, d.y));
        if (Math.abs(T.x - d.x) < T.q + T.r * 0.5) d.r -= dt * 26;
        return d.r > 0.6;
      });
      if (s.sats.length) still = false;
    }
    if (s.moving && still) {
      s.moving = false;
      if (!s.reduce) s.rips.push({ x: T.x, y: T.cy, age: 0, amp: s.split ? 1.2 : 0.7 });
    }
    s.rips.forEach((p) => (p.age += dt));
    s.rips = s.rips.filter((p) => p.age < 2.4);
    s.mouse.s += ((s.mouse.on ? 1 : 0) - s.mouse.s) * Math.min(1, dt * 7);
  };

  /* ---- the frame loop: runs only while something moves ---- */
  const loop = () => {
    const s = st.current;
    if (s.raf) return;
    s.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - s.last) / 1000, 1 / 30);
      s.last = now;
      step(dt, now);
      draw();
      const busy = s.moving || s.rips.length > 0 || s.sats.length > 0 || s.mouse.on || s.mouse.s > 0.01;
      s.raf = s.visible && busy ? requestAnimationFrame(tick) : 0;
    };
    s.raf = requestAnimationFrame(tick);
  };

  /* ---- layout: where the dock is, where the drop should go ---- */
  const measure = () => {
    const box = container.current;
    const canvas = canvasRef.current;
    if (!box) return;
    const s = st.current;
    const T = s.t;
    s.w = box.offsetWidth;
    s.h = box.offsetHeight;
    s.radius = Math.min(s.h / 2, parseFloat(getComputedStyle(box).borderTopLeftRadius) || 20);
    const tile = targetRef.current();
    s.has = Boolean(tile);
    if (tile) {
      const at = offsetIn(tile, box);
      T.r = Math.max(tile.offsetWidth, tile.offsetHeight) / 2 + GROW;
      T.q = 0;
      T.cy = PAD + at.y + tile.offsetHeight / 2;
      const nx = PAD + at.x + tile.offsetWidth / 2;
      if (!s.ready) {
        s.a.x = s.b.x = nx;
        s.q = T.q;
        s.ready = true;
      } else if (Math.abs(nx - T.x) > 0.5) {
        s.lead = Math.abs(nx - s.a.x) <= Math.abs(nx - s.b.x) ? 0 : 1;
        s.lagFrom = performance.now() + 70;
        s.moving = true;
        s.split = false;
      }
      T.x = nx;
    }
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = s.w + PAD * 2;
      const height = s.h + PAD * 2;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    }
    if (s.moving) loop();
    else draw();
  };
  const measureRef = useRef(measure);
  useLayoutEffect(() => {
    measureRef.current = measure;
  });

  // Set up once: WebGL (or the CSS drop), pointer swell and ripples, size changes.
  useEffect(() => {
    const s = st.current;
    const box = container.current;
    const canvas = canvasRef.current;
    s.reduce = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    // No WebGL here (an old browser, a test page): the CSS drop stands in.
    s.glc = canvas && typeof WebGLRenderingContext !== "undefined" ? initGL(canvas) : null;
    if (!s.glc && canvas) canvas.style.display = "none";
    if (s.glc && dropRef.current) dropRef.current.style.display = "none";
    const lost = (event: Event) => {
      event.preventDefault();
      s.glc = null;
      if (canvas) canvas.style.display = "none";
      if (dropRef.current) dropRef.current.style.display = "";
      measureRef.current();
    };
    canvas?.addEventListener("webglcontextlost", lost);
    if (!box) return;
    const local = (event: PointerEvent) => {
      const r = box.getBoundingClientRect();
      return { x: event.clientX - r.left + PAD, y: event.clientY - r.top + PAD };
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || s.reduce) return;
      const p = local(event);
      s.mouse.x = p.x;
      s.mouse.y = p.y;
      s.mouse.on = true;
      loop();
    };
    const leave = () => {
      s.mouse.on = false;
      loop();
    };
    const press = (event: PointerEvent) => {
      if (s.reduce) return;
      const p = local(event);
      s.rips.push({ x: p.x, y: p.y, age: 0, amp: 0.8 });
      loop();
    };
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerleave", leave);
    box.addEventListener("pointerdown", press);
    let lastWidth = -1;
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (box.offsetWidth === lastWidth) return;
            lastWidth = box.offsetWidth;
            s.ready = false;
            measureRef.current();
          });
    resize?.observe(box);
    const seen =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            s.visible = entry.isIntersecting;
          });
    seen?.observe(box);
    // Fonts and the dock's own layout settle after the first paint: place the drop again then.
    void document.fonts?.ready.then(() => {
      s.ready = false;
      measureRef.current();
    });
    return () => {
      canvas?.removeEventListener("webglcontextlost", lost);
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerleave", leave);
      box.removeEventListener("pointerdown", press);
      resize?.disconnect();
      seen?.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once; the loop reads live state
  }, []);

  // A new place: the drop flows to its tile.
  useLayoutEffect(() => {
    measureRef.current();
  }, [current]);

  return (
    <li role="presentation" aria-hidden className="pointer-events-none absolute inset-0 -z-10" data-slot="dock-water">
      <canvas ref={canvasRef} className="absolute" style={{ left: -PAD, top: -PAD }} />
      {/* Without WebGL: a plain drop that slides. */}
      <span
        ref={dropRef}
        className="absolute left-0 rounded-full bg-[radial-gradient(120%_140%_at_30%_0%,rgb(255_255_255/0.75),rgb(255_255_255/0)_55%),rgb(255_255_255/0.38)] shadow-[inset_0_1px_1px_rgb(255_255_255/0.95),inset_0_-2px_6px_rgb(0_162_255/0.22),inset_0_0_0_1px_rgb(255_255_255/0.55),0_6px_16px_-6px_rgb(0_70_140/0.45)] will-change-transform dark:bg-[radial-gradient(120%_140%_at_30%_0%,rgb(255_255_255/0.35),rgb(255_255_255/0)_55%),rgb(255_255_255/0.12)]"
      />
    </li>
  );
}
