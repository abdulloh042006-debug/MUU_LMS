"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { Empty, ErrorNote, IconChip, Page, PageHeader, PageSkeleton, Pill } from "@/components/mu/kit";
import { notifyMeta } from "@/components/mu/notify-meta";
import { fmtDateTime } from "@/lib/format";
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
      <Page>
        <PageHeader
          eyebrow="Markaz"
          title="Bildirishnomalar"
          description="Topshiriq, baho, material va darslardagi muhim o‘zgarishlar."
          actions={
            unread > 0 ? (
              <button type="button" onClick={markAll} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold text-navy-700 shadow-card hover:bg-navy-50 disabled:opacity-60">
                <CheckCheck size={16} /> Hammasini o‘qildi
              </button>
            ) : undefined
          }
        />
        {error && <div className="mb-4"><ErrorNote message={error} onRetry={load} /></div>}
        {loading && !items.length ? (
          <PageSkeleton rows={3} />
        ) : !items.length ? (
          <Empty icon={Bell} title="Hozircha bildirishnoma yo‘q" />
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => {
              const meta = notifyMeta(item.type);
              const body = (
                <>
                  <IconChip icon={meta.icon} tone={meta.tone} />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                      {!item.is_read && <span className="size-2 rounded-full bg-gold-500" />}
                    </div>
                    {item.message && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.message}</p>}
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                    <time dateTime={item.created_at} className="text-[11px] text-slate-400">{fmtDateTime(item.created_at)}</time>
                  </div>
                </>
              );
              const cls = `flex w-full items-center gap-4 rounded-2xl border p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift ${item.is_read ? "bg-white" : "bg-gold-50/70 ring-1 ring-inset ring-gold-200"}`;
              return (
                <li key={item.id}>
                  {item.link ? (
                    <Link
                      href={item.link}
                      className={cls}
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
                    <button type="button" className={cls} onClick={() => void markRead(item)}>
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Page>
    </ProtectedRoute>
  );
}
