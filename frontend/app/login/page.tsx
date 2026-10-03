"use client";
import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
export default function Login() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false);
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
  return (
    <AuthLayout>
      <div className="auth-form">
        <div className="auth-symbol">
          <GraduationCap size={25} />
        </div>
        <p className="eyebrow">SHAXSIY KABINET</p>
        <h2>Xush kelibsiz!</h2>
        <p className="auth-intro">
          O‘qishni davom ettirish uchun hisobingizga kiring.
        </p>
        <form onSubmit={submit} className="space-y-5">
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
            <div className="password-input">
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
                onClick={() => setShow(!show)}
                aria-label={show ? "Parolni yashirish" : "Parolni ko‘rsatish"}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <Button
            className="auth-submit"
            disabled={isLoading || !username.trim() || !password}
          >
            {isLoading ? "Kirilmoqda…" : "Kabinetga kirish"}
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="auth-switch">
          Hisobingiz yo‘qmi? <Link href="/register">Ro‘yxatdan o‘tish</Link>
        </p>
        <div className="auth-separator" />
        <p className="auth-support">
          Kirishda muammo bo‘lsa, universitet administratoriga murojaat qiling.
        </p>
      </div>
    </AuthLayout>
  );
}
