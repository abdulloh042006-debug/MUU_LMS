"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import {
  getNotifications,
  NOTIFICATIONS_CHANGED,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api-service";

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getNotifications();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError("Bildirishnomalarni yuklab bo‘lmadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
  }, [load]);

  const unread = useMemo(
    () => items.reduce((total, item) => total + (item.is_read ? 0 : 1), 0),
    [items],
  );

  async function markRead(item: Notification) {
    if (item.is_read) return;
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, is_read: true } : entry,
      ),
    );
    try {
      await markNotificationRead(item.id);
    } catch {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, is_read: false } : entry,
        ),
      );
    }
  }

  async function markAll() {
    if (!unread || busy) return;
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((item) => ({ ...item, is_read: true })),
      );
    } catch {
      setError("Bildirishnomalarni yangilab bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute>
      <main className="workspace-page notifications-page">
        <div className="workspace-heading">
          <div>
            <h1>Bildirishnomalar</h1>
            <p>
              Topshiriq, baho, material va darslardagi muhim o‘zgarishlar shu
              yerda.
            </p>
          </div>
          {unread > 0 && (
            <Button type="button" variant="outline" onClick={markAll} disabled={busy}>
              <CheckCheck size={16} />
              Hammasini o‘qildi
            </Button>
          )}
        </div>

        {error && (
          <div className="notification-state error">
            <span>{error}</span>
            <button type="button" onClick={load} aria-label="Qayta yuklash">
              <RefreshCw size={16} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="notification-state">Yuklanmoqda…</div>
        ) : !items.length ? (
          <div className="empty-message">
            <Bell />
            <span>Hozircha bildirishnoma yo‘q.</span>
          </div>
        ) : (
          <div className="notifications-page-list">
            {items.map((item) => {
              const body = (
                <>
                  <div>
                    <strong>{item.title}</strong>
                    {item.message && <p>{item.message}</p>}
                    <time dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString("uz-UZ", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Tashkent",
                      })}
                    </time>
                  </div>
                  {!item.is_read && <span className="notifications-unread-dot" />}
                </>
              );

              return item.link ? (
                <Link
                  key={item.id}
                  href={item.link}
                  className={`notifications-page-item ${item.is_read ? "" : "unread"}`}
                  onClick={async (event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    await markRead(item);
                    router.push(item.link);
                  }}
                >
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  key={item.id}
                  className={`notifications-page-item ${item.is_read ? "" : "unread"}`}
                  onClick={() => void markRead(item)}
                >
                  {body}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
