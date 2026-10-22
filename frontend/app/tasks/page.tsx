"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, ListTodo, Plus, Trash2 } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { Empty, Page, PageHeader } from "@/components/mu/kit";
import { cn } from "@/lib/utils";

type Task = { id: number; text: string; done: boolean };
const KEY = "mu-staff-tasks";

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: "Oraliq nazorat savollarini tayyorlash", done: false },
    { id: 2, text: "Python topshiriqlarini tekshirish", done: false },
    { id: 3, text: "Dars materiallarini yangilash", done: true },
  ]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setTasks(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(tasks));
    } catch {}
  }, [tasks, ready]);

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = String(fd.get("text") || "").trim();
    if (!text) return;
    setTasks([{ id: Date.now(), text, done: false }, ...tasks]);
    e.currentTarget.reset();
  }

  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="Ish" title="Vazifalarim" description="Shaxsiy ish rejangiz (shu brauzerda saqlanadi)." />
        <form onSubmit={add} className="mb-5 flex gap-2">
          <input name="text" placeholder="Yangi vazifa…" className="h-12 flex-1 rounded-xl border bg-white px-4 text-sm shadow-card outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-200" />
          <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white hover:bg-navy-800"><Plus size={17} /> Qo‘shish</button>
        </form>
        {tasks.length ? (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border bg-white p-3.5 shadow-card">
                <button onClick={() => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} aria-label="Bajarildi" className={cn("grid size-7 shrink-0 place-items-center rounded-lg border-2 transition", t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300")}>
                  {t.done && <Check size={15} />}
                </button>
                <span className={cn("flex-1 text-sm", t.done && "text-slate-400 line-through")}>{t.text}</span>
                <button onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))} aria-label="O‘chirish" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        ) : <Empty icon={ListTodo} title="Vazifa yo‘q" />}
      </Page>
    </StaffPage>
  );
}
