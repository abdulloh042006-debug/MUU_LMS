"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api-service";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell() {
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
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="notification-trigger"
          aria-label={
            unread
              ? `Bildirishnomalar — ${unread} ta yangi`
              : "Bildirishnomalar"
          }
        >
          <Bell size={19} />
          {unread > 0 && (
            <span className="notification-count" aria-hidden="true">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="notification-panel p-0"
      >
        <div className="notification-panel-header">
          <div>
            <strong>Bildirishnomalar</strong>
            <small>{unread ? `${unread} ta yangi` : "Hammasi o‘qilgan"}</small>
          </div>
          {unread > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={markAll}
            >
              <CheckCheck size={15} />
              O‘qildi
            </Button>
          )}
        </div>

        {error && (
          <div className="notification-state error">
            <span>{error}</span>
            <button type="button" onClick={load} aria-label="Qayta yuklash">
              <RefreshCw size={15} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="notification-state">Yuklanmoqda…</div>
        ) : !items.length ? (
          <div className="notification-state">Yangi bildirishnoma yo‘q.</div>
        ) : (
          <div className="notification-list">
            {items.map((item) => {
              const body = (
                <>
                  <span className="notification-title">{item.title}</span>
                  {item.message && (
                    <span className="notification-message">{item.message}</span>
                  )}
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString("uz-UZ", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </>
              );
              return item.link ? (
                <Link
                  href={item.link}
                  key={item.id}
                  className={`notification-item ${item.is_read ? "" : "unread"}`}
                  onClick={() => {
                    void markRead(item);
                    setOpen(false);
                  }}
                >
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  key={item.id}
                  className={`notification-item ${item.is_read ? "" : "unread"}`}
                  onClick={() => void markRead(item)}
                >
                  {body}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
