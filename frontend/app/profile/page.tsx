"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { changePassword, updateUserProfile } from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function Profile() {
  const { user, reloadUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setName(user?.fullname || "");
    setEmail(user?.email || "");
    setBio(user?.bio || "");
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateUserProfile({ fullname: name, email, bio });
      await reloadUser();
      setMessage("Profil saqlandi.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordMessage("Yangi parollar bir xil emas.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Parol muvaffaqiyatli o‘zgartirildi.");
    } catch (e) {
      setPasswordMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <ProtectedRoute>
      <main className="max-w-xl mx-auto p-8">
        <Link href="/dashboard">← Bosh sahifa</Link>
        <h1 className="text-3xl font-bold my-6">Mening profilim</h1>

        <form onSubmit={save} className="space-y-4">
          <Label htmlFor="name">Ism-familiya</Label>
          <Input
            id="name"
            required
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Label htmlFor="email">Elektron pochta</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Label htmlFor="bio">O‘zim haqimda</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />

          <Button disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </Button>
          <p role="status">{message}</p>
        </form>

        <div className="my-8 border-t" />

        <h2 className="text-xl font-semibold mb-4">Parolni o‘zgartirish</h2>
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
            <Label htmlFor="confirm-password">Yangi parolni takrorlang</Label>
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
            Parolni unutgan bo‘lsangiz, universitet administratoriga murojaat qiling.
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
            {changingPassword ? "O‘zgartirilmoqda…" : "Parolni o‘zgartirish"}
          </Button>
          <p role="status">{passwordMessage}</p>
        </form>
      </main>
    </ProtectedRoute>
  );
}
