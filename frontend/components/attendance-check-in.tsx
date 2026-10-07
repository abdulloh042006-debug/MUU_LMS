"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  Camera,
  CheckCircle2,
  MapPin,
  Radio,
  ScanLine,
} from "lucide-react";
import * as api from "@/lib/api-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ActiveSession = {
  id: number;
  course_code: string;
  course_title: string;
  topic: string;
  starts_at: string;
  late_after_at: string;
  check_in_ends_at: string;
  attendance_minutes: number;
  already_checked_in: boolean;
};

type GeoPayload = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function freshLocation(): Promise<GeoPayload> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Qurilmada lokatsiya xizmati topilmadi."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () =>
        reject(
          new Error(
            "Lokatsiyani olishga ruxsat bering va GPS/location xizmatini yoqing.",
          ),
        ),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000,
      },
    );
  });
}

export function AttendanceCheckIn({
  onCheckedIn,
}: {
  onCheckedIn?: () => void | Promise<void>;
}) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySession, setBusySession] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState("");
  const [manualQrOpen, setManualQrOpen] = useState(false);
  const [manualQrValue, setManualQrValue] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const autoUltrasoundTriedRef = useRef<Set<number>>(new Set());
  const ultrasoundListenerRef = useRef<
    (session: ActiveSession, silent?: boolean) => Promise<void>
  >(async () => undefined);

  const load = useCallback(async () => {
    try {
      const data = await api.getActiveAttendance();
      setSessions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  function stopScanner() {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    if (!scannerOpen) stopScanner();
    return () => stopScanner();
  }, [scannerOpen]);

  async function submitCheckIn(
    session: number,
    channel: "qr" | "ultrasound",
    proof: string,
    geoPromise: Promise<GeoPayload>,
  ) {
    setBusySession(session);
    setError("");
    setMessage("");
    try {
      const geo = await geoPromise;
      const result = await api.checkInAttendance({
        session,
        channel,
        proof,
        ...geo,
      });
      const status =
        result.status === "late" ? "Kechikdi" : result.status === "present" ? "Qatnashdi" : result.status;
      setMessage(
        result.manual_override
          ? "Ustozning qo‘lda qo‘ygan holati saqlandi."
          : "Davomat tasdiqlandi: " + status + ".",
      );
      await load();
      await onCheckedIn?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusySession(null);
    }
  }

  async function startQrScanner() {
    setError("");
    setMessage("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Kamera uchun HTTPS yoki telefonda localhost orqali xavfsiz ulanish kerak.");
      return;
    }
    setScannerStatus("Kamera ochilmoqda…");
    setScannerOpen(true);

    const geoPromise = freshLocation();
    void geoPromise.catch(() => undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Kamera oynasi tayyor emas.");
      video.srcObject = stream;
      await video.play();

      const track = stream.getVideoTracks()[0];
      const capabilities = (track.getCapabilities?.() || {}) as Record<
        string,
        any
      >;
      const advanced: Record<string, any> = {};
      let zoom = 1;
      if (capabilities.zoom) {
        zoom = Math.min(
          capabilities.zoom.max,
          Math.max(capabilities.zoom.min, 1.8),
        );
        advanced.zoom = zoom;
      }
      if (Array.isArray(capabilities.focusMode)) {
        if (capabilities.focusMode.includes("continuous"))
          advanced.focusMode = "continuous";
      }
      if (Object.keys(advanced).length) {
        await track
          .applyConstraints({ advanced: [advanced] } as MediaTrackConstraints)
          .catch(() => undefined);
      }

      const Detector = (window as any).BarcodeDetector;
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!detector && !context) {
        throw new Error("QR skaner uchun kamera oynasi ochilmadi.");
      }
      setScannerStatus(
        detector
          ? "QR kodni kameraga qarating. Zoom avtomatik ishlaydi."
          : "QR kodni kameraga qarating. iPhone uchun mos skaner ishlamoqda.",
      );

      let detecting = false;
      scanTimerRef.current = window.setInterval(async () => {
        if (detecting || !videoRef.current || videoRef.current.readyState < 2)
          return;
        detecting = true;
        try {
          let raw = "";
          if (detector) {
            const codes = await detector.detect(videoRef.current);
            raw = codes?.[0]?.rawValue || "";
          } else if (context) {
            const video = videoRef.current;
            const sourceSize = Math.min(video.videoWidth, video.videoHeight);
            const sourceX = (video.videoWidth - sourceSize) / 2;
            const sourceY = (video.videoHeight - sourceSize) / 2;
            const size = Math.min(sourceSize, 1080);
            canvas.width = size;
            canvas.height = size;
            context.drawImage(video, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
            const result = jsQR(context.getImageData(0, 0, size, size).data, size, size, {
              inversionAttempts: "attemptBoth",
            });
            raw = result?.data || "";
          }
          if (!raw) return;
          let payload: { v?: number; session?: number; proof?: string };
          try {
            payload = JSON.parse(raw);
          } catch {
            setScannerStatus("Bu MUU davomat QR kodi emas.");
            return;
          }
          if (
            payload.v !== 1 ||
            !Number.isInteger(payload.session) ||
            !payload.proof
          ) {
            setScannerStatus("QR kodi formati noto‘g‘ri.");
            return;
          }
          stopScanner();
          setScannerOpen(false);
          await submitCheckIn(
            Number(payload.session),
            "qr",
            payload.proof,
            geoPromise,
          );
        } finally {
          detecting = false;
        }
      }, 220);
    } catch (e) {
      stopScanner();
      setScannerStatus("");
      setScannerOpen(false);
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Kamera ruxsati rad etildi. Brauzer sozlamalarida Camera → Allow ni tanlang.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("Kamera topilmadi. Kamera ulanganini va boshqa ilova ishlatmayotganini tekshiring.");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  async function submitManualQr() {
    setError("");
    let payload: { v?: number; session?: number; proof?: string };
    try {
      payload = JSON.parse(manualQrValue.trim());
    } catch {
      setError("QR kod matni JSON formatida bo‘lishi kerak.");
      return;
    }
    if (payload.v !== 1 || !Number.isInteger(payload.session) || !payload.proof) {
      setError("QR kodi formati noto‘g‘ri.");
      return;
    }
    setManualQrOpen(false);
    setManualQrValue("");
    await submitCheckIn(Number(payload.session), "qr", payload.proof, freshLocation());
  }

  async function listenUltrasound(session: ActiveSession, silent = false) {
    if (silent) return;
    setBusySession(session.id);
    setError("");
    setMessage("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      if (!silent) {
        setBusySession(null);
        setError("Mikrofon faqat HTTPS sahifada ishlaydi. Tugmani bosgandan keyin brauzer oynasida Allow/Ruxsat bering.");
      }
      return;
    }
    const geoPromise = freshLocation();
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let timer: number | null = null;

    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: { ideal: 48000 },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
      } catch (microphoneError) {
        const name = microphoneError instanceof DOMException ? microphoneError.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          throw new Error("Mikrofon ruxsati rad etildi. Brauzer manzil satridagi qulf belgisidan Mikrofon → Allow ni tanlang.");
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          throw new Error("Mikrofon topilmadi. Qurilmaga mikrofon ulang yoki tizim sozlamalarida mikrofonni yoqing.");
        }
        throw new Error("Mikrofonni ochib bo‘lmadi. Brauzer ruxsati va qurilma mikrofonini tekshiring.");
      }
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) throw new Error("Web Audio qo‘llab-quvvatlanmaydi.");
      ctx = new AudioCtor();
      await ctx.resume();
      if (ctx.sampleRate < 40000) {
        throw new Error("Bu qurilma mikrofoni ultrasound diapazonini bermayapti.");
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.15;
      source.connect(analyser);
      const spectrum = new Float32Array(analyser.frequencyBinCount);
      const start = performance.now();
      let preambleSeen = false;
      let lastPreambleAt = 0;
      const bestIndex: Array<number | null> = Array(8).fill(null);
      const bestDb = Array(8).fill(-Infinity);

      const powerAt = (frequency: number) => {
        const bin = Math.round(
          (frequency / ctx!.sampleRate) * analyser.fftSize,
        );
        return spectrum[Math.max(0, Math.min(spectrum.length - 1, bin))];
      };

      const finish = async (code: string) => {
        if (timer) window.clearInterval(timer);
        stream?.getTracks().forEach((track) => track.stop());
        await ctx?.close().catch(() => undefined);
        await submitCheckIn(session.id, "ultrasound", code, geoPromise);
      };

      timer = window.setInterval(() => {
        analyser.getFloatFrequencyData(spectrum);
        const now = performance.now();
        if (now - start > 9000) {
          if (timer) window.clearInterval(timer);
          stream?.getTracks().forEach((track) => track.stop());
          ctx?.close().catch(() => undefined);
          if (!silent) {
            setBusySession(null);
            setError(
              "Ultrasound signal topilmadi. QR orqali urinib ko‘ring.",
            );
          }
          return;
        }

        const preambleDb = powerAt(16900);
        const dataPowers = Array.from({ length: 16 }, (_, index) =>
          powerAt(17200 + index * 130),
        );
        const maxDataDb = Math.max(...dataPowers);

        if (!preambleSeen) {
          if (preambleDb > -82 && preambleDb > maxDataDb + 2) {
            preambleSeen = true;
            lastPreambleAt = now;
          }
          return;
        }

        if (preambleDb > -82 && preambleDb > maxDataDb + 2) {
          lastPreambleAt = now;
          return;
        }

        const firstTarget = lastPreambleAt + 250;
        for (let index = 0; index < 8; index += 1) {
          const target = firstTarget + index * 250;
          if (Math.abs(now - target) > 90) continue;
          let symbol = 0;
          let symbolDb = -Infinity;
          for (let candidate = 0; candidate < 16; candidate += 1) {
            if (dataPowers[candidate] > symbolDb) {
              symbolDb = dataPowers[candidate];
              symbol = candidate;
            }
          }
          if (symbolDb > -86 && symbolDb > bestDb[index]) {
            bestDb[index] = symbolDb;
            bestIndex[index] = symbol;
          }
        }

        const finalTarget = firstTarget + 7 * 250;
        if (now > finalTarget + 130) {
          if (bestIndex.every((value) => value !== null)) {
            const code = bestIndex
              .map((value) => Number(value).toString(16))
              .join("");
            void finish(code);
          } else {
            preambleSeen = false;
            lastPreambleAt = 0;
            bestIndex.fill(null);
            bestDb.fill(-Infinity);
          }
        }
      }, 25);
    } catch (e) {
      if (timer) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      await ctx?.close().catch(() => undefined);
      if (!silent) {
        setBusySession(null);
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  ultrasoundListenerRef.current = listenUltrasound;

  useEffect(() => {
    autoUltrasoundTriedRef.current.clear();
  }, [sessions]);

  if (loading) return <p className="mb-5">Faol davomat tekshirilmoqda…</p>;

  return (
    <>
      <div className="mb-6 space-y-3">
        {sessions.map((session) => (
          <Card key={session.id}>
            <CardContent className="p-5">
              <div className="attendance-session-row flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin size={17} />
                    <strong>
                      {session.course_code} · {session.topic}
                    </strong>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {session.course_title} ·{" "}
                    {session.already_checked_in
                      ? "Davomat allaqachon qayd etilgan"
                      : "Auditoriyada bo‘lsangiz tasdiqlang"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busySession !== null}
                    onClick={startQrScanner}
                  >
                    <ScanLine size={16} />
                    QR skan
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busySession !== null}
                    onClick={() => setManualQrOpen(true)}
                  >
                    QR fallback (debug)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busySession !== null || session.already_checked_in}
                    onClick={() => void listenUltrasound(session)}
                  >
                    <Radio size={16} />
                    {busySession === session.id ? "Tinglanmoqda…" : "Ultrasound"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!sessions.length && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm text-muted-foreground">
                Hozir faol davomat sessiyasi yo‘q. Ustoz boshlagach bu yerda ko‘rinadi.
              </p>
              <Button type="button" variant="outline" onClick={() => void startQrScanner()}>
                <ScanLine size={16} />
                QR skanerni ochish
              </Button>
            </CardContent>
          </Card>
        )}
        {message && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 size={17} />
            {message}
          </div>
        )}
        {error && (
          <div role="alert" className="w-full min-w-0 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6 text-destructive">
            {error}
          </div>
        )}
      </div>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Davomat QR skaneri</DialogTitle>
            <DialogDescription>
              Kamera QR kodga avtomatik yaqinlashadi va fokuslaydi.
            </DialogDescription>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              playsInline
              muted
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative aspect-square w-[min(68vw,18rem)] max-w-[calc(100%-2rem)] rounded-2xl border-4 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]">
                <span className="absolute -top-1 -left-1 size-8 border-t-4 border-l-4 border-primary" />
                <span className="absolute -top-1 -right-1 size-8 border-t-4 border-r-4 border-primary" />
                <span className="absolute -bottom-1 -left-1 size-8 border-b-4 border-l-4 border-primary" />
                <span className="absolute -right-1 -bottom-1 size-8 border-r-4 border-b-4 border-primary" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Camera size={16} />
            {scannerStatus || "Kamera tayyorlanmoqda…"}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manualQrOpen} onOpenChange={setManualQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR matnini qo‘lda kiritish</DialogTitle>
            <DialogDescription>
              Faqat texnik test uchun QR kodning JSON matnini kiriting.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={manualQrValue}
            onChange={(event) => setManualQrValue(event.target.value)}
            placeholder='{"v":1,"session":123,"proof":"..."}'
            aria-label="QR kodi JSON matni"
          />
          <Button type="button" onClick={() => void submitManualQr()}>
            Davomatni tasdiqlash
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
