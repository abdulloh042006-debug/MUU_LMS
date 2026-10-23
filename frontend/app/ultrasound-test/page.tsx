"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Radio, RefreshCw, Smartphone, Laptop, Repeat, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Ultratovush davomatini tez sinash sahifasi (login talab qilmaydi).
 * Parametrlar ilovadagi bilan bir xil:
 *  - preambula 16900 Hz (0.4 s), keyin 8 ta hex belgi: 17200 + v*130 Hz, har biri 0.2 s, oralig'i 0.25 s
 *  - qabul qiluvchi: fftSize 8192, chegaralar -82 dB (preambula) va -86 dB (belgi)
 */

type Ctx = AudioContext;
const AudioCtor = () =>
  typeof window === "undefined" ? undefined : window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

const randomCode = () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

async function playCode(ctx: Ctx, code: string, volume: number) {
  await ctx.resume();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  gain.connect(ctx.destination);
  const tone = (frequency: number, start: number, duration: number) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(1, start + 0.015);
    env.gain.setValueAtTime(1, start + Math.max(0.02, duration - 0.02));
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(gain);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  };
  const now = ctx.currentTime + 0.05;
  tone(16900, now, 0.4);
  let cursor = now + 0.55;
  for (const ch of code) {
    tone(17200 + Number.parseInt(ch, 16) * 130, cursor, 0.2);
    cursor += 0.25;
  }
  return cursor - ctx.currentTime;
}

type Hit = { code: string; at: number; ms: number; ok: boolean | null };

export default function UltrasoundTest() {
  const [mode, setMode] = useState<"send" | "listen" | "loop">("send");
  return (
    <main className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">Millat Umidi LMS</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold">Ultratovush sinovi</h1>
        <p className="mt-2 text-sm text-navy-200">
          1-qurilma (kompyuter) <b>signal beradi</b>, 2-qurilma (telefon) <b>eshitadi</b>. Ikkalasida ham shu sahifani oching.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-white/10 p-1">
          {([
            ["send", "Signal berish", Laptop],
            ["listen", "Eshitish", Smartphone],
            ["loop", "1 qurilmada", Repeat],
          ] as const).map(([v, l, I]) => (
            <button key={v} onClick={() => setMode(v)} className={cn("flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition", mode === v ? "bg-gold-500 text-navy-950" : "text-navy-100")}>
              <I size={16} /> {l}
            </button>
          ))}
        </div>
        <div className="mt-5">{mode === "send" ? <Sender /> : mode === "listen" ? <Listener /> : <Loopback />}</div>
        <ol className="mt-8 space-y-1.5 text-xs text-navy-300">
          <li>• Kompyuter ovozini 70–100% qiling, Bluetooth quloqchinni uzing.</li>
          <li>• Telefonni kompyuterdan 0.5–3 m masofada ushlang, mikrofonni yopmang.</li>
          <li>• iPhone Safari ultratovushni ko‘pincha kesadi — Android Chrome’da ham sinab ko‘ring.</li>
          <li>• Natija ishlamasa: “1 qurilmada” rejimida kompyuterning o‘zida tekshiring.</li>
        </ol>
      </div>
    </main>
  );
}

function Sender() {
  const [code, setCode] = useState(randomCode);
  const [running, setRunning] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [count, setCount] = useState(0);
  const ctxRef = useRef<Ctx | null>(null);
  const timer = useRef<number | null>(null);
  const live = useRef({ code, volume });
  live.current = { code, volume };

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  async function start() {
    const C = AudioCtor();
    if (!C) return alert("Brauzer Web Audio’ni qo‘llamaydi.");
    ctxRef.current ??= new C();
    setRunning(true);
    const loop = async () => {
      const d = await playCode(ctxRef.current!, live.current.code, live.current.volume);
      setCount((c) => c + 1);
      timer.current = window.setTimeout(loop, (d + 0.6) * 1000);
    };
    void loop();
  }
  function stop() {
    if (timer.current) window.clearTimeout(timer.current);
    setRunning(false);
  }

  return (
    <section className="rounded-3xl bg-white p-6 text-navy-900 shadow-pop">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Yuborilayotgan kod</p>
      <p className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{code.toUpperCase()}</p>
      <button onClick={() => setCode(randomCode())} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-600"><RefreshCw size={13} /> Yangi kod</button>
      <label className="mt-5 block text-sm font-medium">
        Signal balandligi: {Math.round(volume * 100)}%
        <input type="range" min={0.05} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-2 w-full accent-[#1b2a4a]" />
      </label>
      <button onClick={running ? stop : start} className={cn("mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white", running ? "bg-rose-600" : "bg-navy-700")}>
        <Radio size={20} className={running ? "animate-pulse" : ""} /> {running ? "To‘xtatish" : "Signalni boshlash"}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">{running ? `Har ~3 soniyada takrorlanmoqda · ${count} marta yuborildi` : "Signal odam qulog‘iga deyarli eshitilmaydi (16.9–19.2 kHz)."}</p>
    </section>
  );
}

/** Mikrofon orqali kodni ilovadagi algoritm bilan o‘qiydi. */
function useDecoder(onCode: (code: string, ms: number) => void) {
  const [state, setState] = useState<"idle" | "listening" | "error">("idle");
  const [err, setErr] = useState("");
  const [meter, setMeter] = useState({ pre: -140, data: -140, bg: -140, phase: "Kutilmoqda", rate: 0 });
  const stopRef = useRef<() => void>(() => {});
  const cb = useRef(onCode);
  cb.current = onCode;

  async function start() {
    setErr("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState("error");
      return setErr("Mikrofon faqat https sahifada ishlaydi.");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: { ideal: 48000 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    } catch (e) {
      setState("error");
      return setErr(e instanceof DOMException && e.name === "NotAllowedError" ? "Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering." : "Mikrofon topilmadi yoki band.");
    }
    const C = AudioCtor()!;
    const ctx = new C();
    await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.15;
    source.connect(analyser);
    const spectrum = new Float32Array(analyser.frequencyBinCount);
    const powerAt = (f: number) => spectrum[Math.max(0, Math.min(spectrum.length - 1, Math.round((f / ctx.sampleRate) * analyser.fftSize)))];
    let preambleSeen = false;
    let lastPreambleAt = 0;
    let firstPreambleAt = 0;
    const bestIndex: Array<number | null> = Array(8).fill(null);
    const bestDb = Array(8).fill(-Infinity);
    let lastUi = 0;
    const timer = window.setInterval(() => {
      analyser.getFloatFrequencyData(spectrum);
      const now = performance.now();
      const pre = powerAt(16900);
      const data = Array.from({ length: 16 }, (_, i) => powerAt(17200 + i * 130));
      const maxData = Math.max(...data);
      if (now - lastUi > 120) {
        let bg = -Infinity;
        for (let i = Math.floor((250 / ctx.sampleRate) * 8192); i <= Math.floor((8000 / ctx.sampleRate) * 8192); i++) bg = Math.max(bg, spectrum[i]);
        lastUi = now;
        setMeter({ pre, data: maxData, bg, phase: preambleSeen ? "Preambula topildi — kod o‘qilmoqda" : "Signal kutilmoqda", rate: ctx.sampleRate });
      }
      if (!preambleSeen) {
        if (pre > -82 && pre > maxData + 2) {
          preambleSeen = true;
          lastPreambleAt = now;
          firstPreambleAt = now;
        }
        return;
      }
      if (pre > -82 && pre > maxData + 2) {
        lastPreambleAt = now;
        return;
      }
      const first = lastPreambleAt + 250;
      for (let i = 0; i < 8; i++) {
        if (Math.abs(now - (first + i * 250)) > 90) continue;
        let sym = 0, db = -Infinity;
        data.forEach((v, k) => { if (v > db) { db = v; sym = k; } });
        if (db > -86 && db > bestDb[i]) { bestDb[i] = db; bestIndex[i] = sym; }
      }
      if (now > first + 7 * 250 + 130) {
        if (bestIndex.every((v) => v !== null)) cb.current(bestIndex.map((v) => Number(v).toString(16)).join(""), Math.round(now - firstPreambleAt));
        preambleSeen = false;
        lastPreambleAt = 0;
        bestIndex.fill(null);
        bestDb.fill(-Infinity);
      }
    }, 25);
    stopRef.current = () => {
      window.clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      setState("idle");
    };
    setState(ctx.sampleRate < 40000 ? "error" : "listening");
    if (ctx.sampleRate < 40000) setErr(`Qurilma mikrofoni ${ctx.sampleRate} Hz — ultratovush uchun kamida 44100 Hz kerak.`);
  }
  useEffect(() => () => stopRef.current(), []);
  return { state, err, meter, start, stop: () => stopRef.current() };
}

function Meter({ label, db, mark }: { label: string; db: number; mark?: number }) {
  const pct = Math.max(0, Math.min(100, ((db + 140) / 110) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>{label}</span><span className="font-mono">{Number.isFinite(db) ? db.toFixed(0) : "—"} dB</span></div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-[width]", db > (mark ?? 0) ? "bg-emerald-500" : "bg-navy-400")} style={{ width: `${pct}%` }} />
        {mark !== undefined && <span className="absolute top-0 h-full w-0.5 bg-gold-600" style={{ left: `${((mark + 140) / 110) * 100}%` }} />}
      </div>
    </div>
  );
}

function ListenerPanel({ expected, onExpected, hits, dec }: { expected: string; onExpected?: (v: string) => void; hits: Hit[]; dec: ReturnType<typeof useDecoder> }) {
  const ok = hits.filter((h) => h.ok).length;
  return (
    <section className="rounded-3xl bg-white p-6 text-navy-900 shadow-pop">
      {onExpected && (
        <label className="block text-sm font-medium">
          Kompyuterdagi kod (ixtiyoriy, solishtirish uchun)
          <input value={expected} onChange={(e) => onExpected(e.target.value.toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 8))} placeholder="masalan 3fa09c1e" className="mt-1.5 h-11 w-full rounded-xl border px-3 font-mono text-lg uppercase tracking-widest outline-none focus:border-gold-500" />
        </label>
      )}
      <button onClick={dec.state === "listening" ? dec.stop : dec.start} className={cn("mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white", dec.state === "listening" ? "bg-rose-600" : "bg-navy-700")}>
        {dec.state === "listening" ? <><MicOff size={20} /> To‘xtatish</> : <><Mic size={20} /> Eshitishni boshlash</>}
      </button>
      {dec.err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{dec.err}</p>}
      {dec.state === "listening" && (
        <div className="mt-5 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 animate-pulse rounded-full bg-emerald-500" /> {dec.meter.phase} · {dec.meter.rate} Hz</p>
          <Meter label="Preambula (16.9 kHz)" db={dec.meter.pre} mark={-82} />
          <Meter label="Ma’lumot (17.2–19.2 kHz)" db={dec.meter.data} mark={-86} />
          <Meter label="Fon shovqini (0.25–8 kHz)" db={dec.meter.bg} />
          <p className="text-[11px] text-muted-foreground">Sariq chiziq — qabul chegarasi. Signal yashil bo‘lsa, telefon eshityapti.</p>
        </div>
      )}
      <div className="mt-5 border-t pt-4">
        <p className="text-sm font-semibold">Natijalar {hits.length > 0 && <span className="font-normal text-muted-foreground">· {hits.length} ta o‘qildi{expected.length === 8 ? `, ${ok} tasi to‘g‘ri` : ""}</span>}</p>
        {hits.length ? (
          <ul className="mt-2 space-y-1.5">
            {hits.slice(0, 8).map((h) => (
              <li key={h.at} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                {h.ok === false ? <XCircle size={16} className="text-rose-600" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
                <span className="font-mono font-bold tracking-widest">{h.code.toUpperCase()}</span>
                <span className="ml-auto text-xs text-muted-foreground">{(h.ms / 1000).toFixed(1)} s</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Hali kod o‘qilmadi.</p>
        )}
      </div>
    </section>
  );
}

function Listener() {
  const [expected, setExpected] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const exp = useRef(expected);
  exp.current = expected;
  const dec = useDecoder((code, ms) => {
    setHits((h) => [{ code, ms, at: Date.now(), ok: exp.current.length === 8 ? code === exp.current : null }, ...h]);
    navigator.vibrate?.(80);
  });
  return <ListenerPanel expected={expected} onExpected={setExpected} hits={hits} dec={dec} />;
}

function Loopback() {
  const [code, setCode] = useState(randomCode);
  const [hits, setHits] = useState<Hit[]>([]);
  const codeRef = useRef(code);
  codeRef.current = code;
  const dec = useDecoder((c, ms) => setHits((h) => [{ code: c, ms, at: Date.now(), ok: c === codeRef.current }, ...h]));
  const ctxRef = useRef<Ctx | null>(null);
  async function send() {
    const C = AudioCtor();
    if (!C) return;
    ctxRef.current ??= new C();
    const next = randomCode();
    setCode(next);
    codeRef.current = next;
    await playCode(ctxRef.current, next, 0.6);
  }
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white/10 p-5 ring-1 ring-inset ring-white/15">
        <p className="text-sm text-navy-100">Bitta qurilma o‘zi signal beradi va o‘zi eshitadi. Avval “Eshitishni boshlash”, keyin “Signal yuborish”.</p>
        <button onClick={send} disabled={dec.state !== "listening"} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold-500 font-semibold text-navy-950 disabled:opacity-40">
          <Radio size={18} /> Signal yuborish · {code.toUpperCase()}
        </button>
      </section>
      <ListenerPanel expected={code} hits={hits} dec={dec} />
    </div>
  );
}
