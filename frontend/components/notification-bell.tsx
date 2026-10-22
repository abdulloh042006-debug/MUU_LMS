"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import {
  getNotifications,
  NOTIFICATIONS_CHANGED,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api-service";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconChip } from "@/components/mu/kit";
import { notifyMeta } from "@/components/mu/notify-meta";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
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
    const refresh = () => {
      void load();
    };
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const unread = useMemo(() => items.reduce((total, item) => total + (item.is_read ? 0 : 1), 0), [items]);

  async function markRead(item: Notification) {
    if (item.is_read) return;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry)));
    try {
      await markNotificationRead(item.id);
    } catch {
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, is_read: false } : entry)));
    }
  }

  async function markAll() {
    if (!unread || busy) return;
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch {
      setError("Bildirishnomalarni yangilab bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative grid size-10 place-items-center rounded-xl border bg-white text-navy-600 shadow-card transition hover:bg-navy-50",
            className,
          )}
          aria-label={unread ? `Bildirishnomalar — ${unread} ta yangi` : "Bildirishnomalar"}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span
              className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-gold-500 px-1 text-[10px] font-bold leading-none text-white"
              aria-hidden="true"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-2xl border p-0 shadow-pop">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
          <div>
            <p className="font-heading text-sm font-semibold text-navy-900">Bildirishnomalar</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{unread ? `${unread} ta yangi` : "Hammasi o‘qilgan"}</p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={markAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50 disabled:opacity-50"
            >
              <CheckCheck size={14} /> Hammasini o‘qildi
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center justify-between gap-2 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={load} aria-label="Qayta yuklash">
              <RefreshCw size={14} />
            </button>
          </div>
        )}

        {loading && !items.length ? (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">Yuklanmoqda…</p>
        ) : !items.length ? (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">Yangi bildirishnoma yo‘q.</p>
        ) : (
          <div className="thin-scroll max-h-[400px] overflow-y-auto">
            {items.slice(0, 8).map((item) => {
              const meta = notifyMeta(item.type);
              const body = (
                <>
                  <IconChip icon={meta.icon} tone={meta.tone} size={36} />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold leading-snug text-navy-900">{item.title}</span>
                      {!item.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-500" />}
                    </span>
                    {item.message && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.message}</span>}
                    <time dateTime={item.created_at} className="mt-1 block text-[10px] text-slate-400">
                      {fmtDateTime(item.created_at)}
                    </time>
                  </span>
                </>
              );
              const cls = cn(
                "flex w-full gap-3 border-b px-4 py-3 transition last:border-0 hover:bg-slate-50",
                !item.is_read && "bg-gold-50/60",
              );
              return item.link ? (
                <Link
                  href={item.link}
                  key={item.id}
                  className={cls}
                  onClick={async (event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    await markRead(item);
                    setOpen(false);
                    router.push(item.link);
                  }}
                >
                  {body}
                </Link>
              ) : (
                <button type="button" key={item.id} className={cls} onClick={() => void markRead(item)}>
                  {body}
                </button>
              );
            })}
          </div>
        )}
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t bg-slate-50/70 px-4 py-3 text-center text-xs font-semibold text-navy-600 hover:bg-navy-50"
        >
          Barchasini ko‘rish
        </Link>
      </PopoverContent>
    </Popover>
  );
}
