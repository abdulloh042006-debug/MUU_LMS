"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Radio, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import * as api from "@/lib/api-service";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Challenge = {
  session: number;
  course_code: string;
  course_title: string;
  topic: string;
  qr_proof: string;
  manual_code: string | null;
  ultrasound_code: string;
  refresh_seconds: number;
  check_in_ends_at: string;
  lesson_ends_at: string;
  late_after_at: string;
  is_open: boolean;
};

type WindowWithAttendanceAudio = Window & {
  __muuAttendanceAudioContext?: AudioContext;
};

export function AttendanceBroadcastPanel({
  sessionId,
  onChanged,
}: {
  sessionId: number;
  onChanged?: () => void | Promise<void>;
}) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const lastPlayedRef = useRef("");
  const onChangedRef = useRef(onChanged);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  async function playCode(code: string) {
    if (!code) return;
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;

    const shared = window as WindowWithAttendanceAudio;
    const ctx = shared.__muuAttendanceAudioContext || new AudioCtor();
    shared.__muuAttendanceAudioContext = ctx;
    await ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    gain.connect(ctx.destination);

    const tone = (frequency: number, start: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(1, start + 0.015);
      envelope.gain.setValueAtTime(
        1,
        start + Math.max(0.02, duration - 0.02),
      );
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    };

    const now = ctx.currentTime + 0.05;
    tone(16900, now, 0.4);
    let cursor = now + 0.55;
    for (const char of code.toLowerCase()) {
      const value = Number.parseInt(char, 16);
      if (Number.isNaN(value)) continue;
      tone(17200 + value * 130, cursor, 0.2);
      cursor += 0.25;
    }
  }

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const refresh = async () => {
      let nextRefreshMs = 5000;
      try {
        const data = await api.getAttendanceChallenge(sessionId);
        if (!active) return;
        setChallenge(data);
        setError("");
        nextRefreshMs = Math.max(
          1000,
          Math.min((data.refresh_seconds || 5) * 1000, 5000),
        );
        if (
          data.ultrasound_code &&
          lastPlayedRef.current !== data.ultrasound_code
        ) {
          lastPlayedRef.current = data.ultrasound_code;
          void playCode(data.ultrasound_code).catch(() => undefined);
        }
        await onChangedRef.current?.();
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) timer = window.setTimeout(() => void refresh(), nextRefreshMs);
      }
    };

    void refresh();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [sessionId]);

  const qrValue = challenge
    ? JSON.stringify({
        v: 1,
        session: challenge.session,
        proof: challenge.qr_proof,
      })
    : "muu-attendance-preparing";

  const checkInEnd = challenge
    ? new Date(challenge.check_in_ends_at).toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tashkent",
      })
    : "—";
  const lessonEnd = challenge
    ? new Date(challenge.lesson_ends_at).toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tashkent",
      })
    : "—";

  return (
    <>
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={18} />
              Davomat kodi
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              QR har 5 soniyada yangilanadi.
            </p>
          </div>
          <span className="status-badge done">
            <Radio size={14} />
            {challenge?.is_open ? "Davomat ochiq" : "Davomat yopiq"}
          </span>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-destructive/5 p-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)]">
          <div className="flex justify-center rounded-2xl bg-white p-5">
            <QRCodeSVG
              value={qrValue}
              size={260}
              level="H"
              marginSize={1}
              title="MUU dinamik davomat QR kodi"
            />
          </div>
          <div className="flex min-h-40 flex-col justify-center rounded-2xl border bg-muted/40 p-5 text-center">
            <span className="text-sm font-medium text-muted-foreground">
              QR ishlamasa — 8 belgili kod
            </span>
            <strong
              aria-live="polite"
              aria-label="Qo‘lda kiritish kodi"
              className="mt-2 font-mono text-3xl font-bold tracking-[0.2em] sm:text-4xl"
            >
              {challenge?.is_open && challenge.manual_code
                ? challenge.manual_code
                : "••••••••"}
            </strong>
            <p className="mt-2 text-xs text-muted-foreground">
              Ustoz kodni talabaga aytadi. Kod har {challenge?.refresh_seconds || 5} soniyada avtomatik yangilanadi.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted/60 p-3">
            <span className="text-muted-foreground">Davomat oynasi</span>
            <strong className="mt-1 block">{checkInEnd} gacha</strong>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <span className="text-muted-foreground">Dars tugashi</span>
            <strong className="mt-1 block">{lessonEnd}</strong>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          disabled={!challenge?.is_open || !challenge.ultrasound_code}
          onClick={async () => {
            const code = challenge?.ultrasound_code;
            if (!code) return;
            try {
              await playCode(code);
              setSoundReady(true);
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          <Radio size={17} />
          {soundReady ? "Ultrasound signal faol" : "Ultrasound signalni yoqish"}
        </Button>

        <Button
          type="button"
          className="mt-3 w-full"
          onClick={() => setFullscreen(true)}
        >
          <Expand size={17} />
          QR ni kattalashtirish
        </Button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Dars va davomat vaqt bo‘yicha avtomatik boshqariladi.
        </p>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{challenge?.topic || "Davomat QR kodi"}</DialogTitle>
            <DialogDescription>
              {challenge?.course_code} · QR kod 5 soniyada yangilanadi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[520px] flex-col items-center justify-center gap-5 rounded-3xl bg-white p-8">
            <QRCodeSVG
              value={qrValue}
              size={460}
              level="H"
              marginSize={1}
              title="MUU fullscreen davomat QR kodi"
            />
            {challenge?.is_open && challenge.manual_code && (
              <p aria-live="polite" className="font-mono text-3xl font-bold tracking-[0.2em]">
                {challenge.manual_code}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
