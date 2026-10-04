"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { changePassword, updateUserProfile } from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Status = { kind: "success" | "error"; text: string } | null;

export default function Profile() {
  const { user, reloadUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setName(user?.fullname || "");
    setEmail(user?.email || "");
    setBio(user?.bio || "");
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateUserProfile({
        fullname: name.trim(),
        email: email.trim(),
        bio: bio.trim(),
      });
      await reloadUser();
      setStatus({ kind: "success", text: "Profil saqlandi." });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        kind: "error",
        text: "Yangi parollar bir xil emas.",
      });
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus({
        kind: "success",
        text: "Parol muvaffaqiyatli o‘zgartirildi.",
      });
    } catch (error) {
      setPasswordStatus({
        kind: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <ProtectedRoute>
      <main className="workspace-page">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">SHAXSIY MA’LUMOT VA XAVFSIZLIK</p>
            <h1>Mening profilim</h1>
            <p>Profil ma’lumotlari va hisob parolini bir joydan boshqaring.</p>
          </div>
        </div>

        <div className="management-grid">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <UserRound size={20} />
                <CardTitle>Profil ma’lumotlari</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-5 rounded-lg bg-muted/60 p-4 text-sm">
                <strong>@{user?.username}</strong>
                <span className="ml-2 text-muted-foreground">
                  · {user?.role === "student" ? "Talaba" : "Ustoz"}
                </span>
              </div>

              {status &&
                (status.kind === "success" ? (
                  <p role="status" className="success-note">
                    {status.text}
                  </p>
                ) : (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{status.text}</AlertDescription>
                  </Alert>
                ))}

              <form onSubmit={save} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Ism-familiya</Label>
                  <Input
                    id="name"
                    required
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Elektron pochta</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">O‘zim haqimda</Label>
                  <Textarea
                    id="bio"
                    maxLength={1000}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>

                <Button disabled={saving || !name.trim()}>
                  {saving ? "Saqlanmoqda…" : "Profilni saqlash"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} />
                <CardTitle>Hisob xavfsizligi</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {passwordStatus &&
                (passwordStatus.kind === "success" ? (
                  <p role="status" className="success-note">
                    {passwordStatus.text}
                  </p>
                ) : (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{passwordStatus.text}</AlertDescription>
                  </Alert>
                ))}

              <form onSubmit={savePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Joriy parol</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Yangi parol</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">
                    Yangi parolni takrorlang
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  Kamida 8 belgi ishlating. Parolni unutgan bo‘lsangiz,
                  universitet administratoriga murojaat qiling.
                </p>

                <Button
                  type="submit"
                  disabled={
                    changingPassword ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                >
                  {changingPassword
                    ? "O‘zgartirilmoqda…"
                    : "Parolni o‘zgartirish"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </ProtectedRoute>
  );
}
