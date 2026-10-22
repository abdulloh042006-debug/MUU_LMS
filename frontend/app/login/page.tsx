"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Send,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { requestAccountRecovery } from "@/lib/api-service";
import { DEMO_MODE } from "@/lib/demo-api";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [studentId, setStudentId] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");

  const {
    login,
    user,
    isLoading,
    error,
    clearError,
    connectionStatus,
    retryConnection,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login(username.trim(), password);
    } catch {}
  }

  async function recover(e: FormEvent) {
    e.preventDefault();
    setRecoveryBusy(true);
    setRecoveryMessage("");
    setRecoveryError("");
    try {
      const result = await requestAccountRecovery(phone.trim(), studentId.trim());
      setRecoveryMessage(result.detail);
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : String(err));
    } finally {
      setRecoveryBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div>
        <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-navy-700 text-gold-500">
          <GraduationCap size={24} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">Shaxsiy kabinet</p>
        <h2 className="mt-1 font-heading text-2xl font-semibold text-navy-900">Xush kelibsiz!</h2>
        <p className="mb-5 mt-1.5 text-sm text-muted-foreground">
          Universitet bergan hisob ma’lumotlari bilan tizimga kiring.
        </p>

        {!recoveryOpen ? (
          <>
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {connectionStatus === "disconnected" && (
                <Alert>
                  <AlertDescription>
                    Server bilan aloqa yo‘q.{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={retryConnection}
                    >
                      Qayta tekshirish
                    </button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Foydalanuvchi nomi</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="Foydalanuvchi nomingiz"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Parol</Label>
                <div className="relative [&_input]:pr-11">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Parolingizni kiriting"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy-700"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Parolni yashirish" : "Parolni ko‘rsatish"}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                className="h-11 w-full rounded-xl bg-navy-700 text-white hover:bg-navy-800"
                disabled={isLoading || !username.trim() || !password}
              >
                {isLoading ? "Kirilmoqda…" : "Kabinetga kirish"}
                <ArrowRight size={17} />
              </Button>
            </form>

            {DEMO_MODE && (
              <div className="mt-4 rounded-2xl border border-gold-200 bg-gold-50 p-4">
                <p className="mb-3 text-center text-sm font-semibold text-navy-800">
                  Demo rejim — parolsiz kirish
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["talaba_demo", "Talaba"],
                    ["ustoz_demo", "Ustoz"],
                    ["admin_demo", "Admin"],
                  ].map(([name, label]) => (
                    <Button
                      key={name}
                      type="button"
                      variant="outline"
                      className="rounded-xl bg-white"
                      disabled={isLoading}
                      onClick={async () => {
                        clearError();
                        try {
                          await login(name, "demo");
                        } catch {}
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {!DEMO_MODE && (
              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
                onClick={() => {
                  clearError();
                  setRecoveryOpen(true);
                }}
              >
                <KeyRound size={16} />
                Login yoki parolni unutdingizmi?
              </button>
            )}

            <p className="mt-4 border-t pt-3 text-center text-xs text-muted-foreground">
              Yangi hisoblarni faqat universitet administratori yaratadi.
            </p>
          </>
        ) : (
          <>
            <div className="mb-5">
              <h3 className="text-lg font-semibold">Hisobni tiklash</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Telefon raqamingiz va talaba ID’ingizni kiriting. Telegram
                oldindan bog‘langan bo‘lsa, bot login va 15 daqiqalik
                vaqtinchalik parol yuboradi.
              </p>
            </div>

            <form onSubmit={recover} className="space-y-4">
              {recoveryMessage && (
                <Alert>
                  <AlertDescription>{recoveryMessage}</AlertDescription>
                </Alert>
              )}
              {recoveryError && (
                <Alert variant="destructive">
                  <AlertDescription>{recoveryError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="recovery-phone">Telefon raqam</Label>
                <Input
                  id="recovery-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+998 90 123 45 67"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-student-id">Talaba ID</Label>
                <Input
                  id="recovery-student-id"
                  autoComplete="off"
                  placeholder="Talaba ID"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
              </div>

              <Button
                className="h-11 w-full rounded-xl bg-navy-700 text-white hover:bg-navy-800"
                disabled={recoveryBusy || !phone.trim() || !studentId.trim()}
              >
                {recoveryBusy ? "Yuborilmoqda…" : "Telegramga yuborish"}
                <Send size={17} />
              </Button>
            </form>

            <button
              type="button"
              className="mt-4 w-full text-center text-sm font-medium text-primary hover:underline"
              onClick={() => {
                setRecoveryOpen(false);
                setRecoveryMessage("");
                setRecoveryError("");
              }}
            >
              Kirish sahifasiga qaytish
            </button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
