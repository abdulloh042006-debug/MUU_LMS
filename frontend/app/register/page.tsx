"use client";
import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
export default function Register() {
  const { register, user, isLoading, error, clearError } = useAuth(),
    router = useRouter(),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearError();
    setMessage("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    if (d.password !== d.confirm_password) {
      setMessage("Parollar bir xil bo‘lishi kerak.");
      return;
    }
    try {
      await register(d);
    } catch {}
  }
  return (
    <AuthLayout>
      <div className="auth-form">
        <p className="eyebrow">TA’LIM YO‘LINGIZ SHU YERDAN BOSHLANADI</p>
        <h2>Hisob yarating</h2>
        <p className="auth-intro">
          Shaxsiy ta’lim kabinetingizga birinchi qadam.
        </p>
        <form onSubmit={submit} className="space-y-4">
          {(error || message) && (
            <Alert variant="destructive">
              <AlertDescription>{message || error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Ism</Label>
              <Input
                id="first_name"
                name="first_name"
                autoComplete="given-name"
                required
                maxLength={24}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Familiya</Label>
              <Input
                id="last_name"
                name="last_name"
                autoComplete="family-name"
                required
                maxLength={25}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Foydalanuvchi nomi</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Elektron pochta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Parol</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Parolni takrorlang</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Kamida 8 belgi. Taxmin qilish qiyin bo‘lgan parol tanlang.
          </p>
          <Button className="auth-submit" disabled={isLoading}>
            {isLoading ? "Yaratilmoqda…" : "Ro‘yxatdan o‘tish"}
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="auth-switch">
          Hisobingiz bormi? <Link href="/login">Tizimga kirish</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
