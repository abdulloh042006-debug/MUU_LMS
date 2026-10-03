"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { updateUserProfile } from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
export default function Profile() {
  const { user, reloadUser } = useAuth();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [bio, setBio] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false);
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
      setMessage(String(e));
    } finally {
      setSaving(false);
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
      </main>
    </ProtectedRoute>
  );
}
