"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Radio, ShieldCheck, Square, Volume2 } from "lucide-react";
import * as api from "@/lib/api-service";
import { Button } from "@/components/ui/button";

type Challenge = {
  session: number;
  course_code: string;
  course_title: string;
  topic: string;
  qr_proof: string;
  ultrasound_code: string;
  refresh_seconds: number;
  check_in_ends_at: string;
  late_after_at: string;
  is_open: boolean;
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
  const [autoSound, setAutoSound] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef("");

  useEffect(() => {
    if (!sessionId) {
      setChallenge(null);
      setAutoSound(false);
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const data = await api.getAttendanceChallenge(sessionId);
        if (active) {
          setChallenge(data);
          setError("");
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  async function playCode(code: string) {
    if (!code) return;
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) throw new Error("Bu brauzer Web Audio ni qo‘llamaydi.");
    const ctx = audioRef.current || new AudioCtor();
    audioRef.current = ctx;
    await ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    gain.connect(ctx.destination);

    const scheduleTone = (frequency: number, start: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(1, start + 0.015);
      envelope.gain.setValueAtTime(1, start + Math.max(0.02, duration - 0.02));
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    };

    const now = ctx.currentTime + 0.05;
    scheduleTone(16900, now, 0.4);
    let cursor = now + 0.55;
    for (const char of code.toLowerCase()) {
      const value = Number.parseInt(char, 16);
      if (Number.isNaN(value)) continue;
      scheduleTone(17200 + value * 130, cursor, 0.2);
      cursor += 0.25;
    }
  }

  useEffect(() => {
    if (
      !autoSound ||
      !challenge?.ultrasound_code ||
      lastPlayedRef.current === challenge.ultrasound_code
    )
      return;
    lastPlayedRef.current = challenge.ultrasound_code;
    playCode(challenge.ultrasound_code).catch((e) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, [autoSound, challenge?.ultrasound_code]);

  async function toggleSound() {
    if (autoSound) {
      setAutoSound(false);
      return;
    }
    try {
      setAutoSound(true);
      if (challenge?.ultrasound_code) {
        lastPlayedRef.current = challenge.ultrasound_code;
        await playCode(challenge.ultrasound_code);
      }
    } catch (e) {
      setAutoSound(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function finalize() {
    if (!sessionId) return;
    setFinalizing(true);
    setError("");
    try {
      await api.finalizeAttendance(sessionId);
      setAutoSound(false);
      await onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFinalizing(false);
    }
  }

  if (!sessionId) return null;

  const qrValue = challenge
    ? JSON.stringify({
        v: 1,
        session: challenge.session,
        proof: challenge.qr_proof,
      })
    : "muu-attendance-preparing";

  return (
    <div className="mt-5 rounded-2xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={18} />
            Himoyalangan avtomatik davomat
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            QR va ultrasound kodi fon rejimida har 5 soniyada yangilanadi.
          </p>
        </div>
        <span className="status-badge done">
          <Radio size={14} />
          {challenge?.is_open ? "Faol" : "Kutilmoqda"}
        </span>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="flex justify-center rounded-2xl bg-white p-3">
          <QRCodeSVG
            value={qrValue}
            size={190}
            level="H"
            marginSize={1}
            title="MUU dinamik davomat QR kodi"
          />
        </div>
        <div className="space-y-3">
          <div>
            <strong>{challenge?.topic || "Davomat tayyorlanmoqda..."}</strong>
            {challenge && (
              <p className="text-sm text-muted-foreground">
                {challenge.course_code} · {challenge.course_title}
              </p>
            )}
          </div>
          {challenge && (
            <p className="text-sm text-muted-foreground">
              Yakun:{" "}
              {new Date(challenge.check_in_ends_at).toLocaleTimeString("uz-UZ", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={toggleSound}>
              {autoSound ? <Square size={16} /> : <Volume2 size={16} />}
              {autoSound ? "Ultrasoundni to‘xtatish" : "Ultrasoundni yoqish"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={finalizing}
              onClick={finalize}
            >
              Davomatni yakunlash
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Yakunlanganda belgilanmagan aktiv talabalar avtomatik
            “Qatnashmadi” bo‘ladi. Qo‘lda tuzatish imkoniyati saqlanadi.
          </p>
        </div>
      </div>
    </div>
  );
}
