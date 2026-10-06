"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Camera, MapPin, Mic, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "muu-attendance-permissions-v1";

function requestLocation() {
  return new Promise<void>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Lokatsiya xizmati topilmadi."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(),
      () => reject(new Error("Lokatsiya ruxsati berilmadi.")),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  });
}

export function AttendancePermissionSetup() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function openPermissionDialog() {
    setError("");
    setOpen(true);
  }

  async function enablePermissions() {
    setBusy(true);
    setError("");
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Kamera ruxsati bu brauzerda mavjud emas.");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      await requestLocation();
      stream.getTracks().forEach((track) => track.stop());
      window.localStorage.setItem(STORAGE_KEY, "granted");
      setOpen(false);
    } catch (e) {
      stream?.getTracks().forEach((track) => track.stop());
      setError(
        e instanceof Error
          ? e.message
          : "Ruxsatlarni yoqib bo‘lmadi. Qurilma sozlamalarini tekshiring.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (user?.role !== "student" || user?.must_change_password) return null;

  return (
    <>
      {pathname === "/attendance" && (
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 text-sm"
          onClick={openPermissionDialog}
        >
          Davomat ruxsatlarini sozlash
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={20} />
            Davomat uchun ruxsatlar
          </DialogTitle>
          <DialogDescription>
            Auditoriyada ekaningizni tasdiqlash uchun joylashuv va kamera kerak.
            Ruxsatni bir marta bersangiz, keyingi davomatlarda qayta so‘ralmaydi.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPin size={16} /> Lokatsiya — auditoriya hududini tekshirish
          </div>
          <div className="flex items-center gap-2">
            <Camera size={16} /> Kamera — davomat kodini skanerlash
          </div>
          <div className="flex items-center gap-2">
            <Mic size={16} /> Mikrofon — qo‘shimcha tekshiruv
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error} Brauzer sozlamalaridan kamera va joylashuvni yoqib, qayta urinib ko‘ring.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Keyinroq
          </Button>
          <Button type="button" disabled={busy} onClick={enablePermissions}>
            {busy ? "Tekshirilmoqda…" : "Ruxsat berish"}
          </Button>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
