"use client";

import { Download, FileText } from "lucide-react";
import { Page, PageHeader, IconChip, Notice } from "@/components/mu/kit";
import { StaffPage } from "@/components/mu/staff";

const DOCS = [
  ["Ichki tartib qoidalari", "O‘qituvchilar uchun umumiy ichki tartib qoidalari", "PDF · 1.2 MB"],
  ["Baholash tartibi", "Ball tizimi, apellyatsiya va qayta topshirish qoidalari", "PDF · 640 KB"],
  ["Davomat nizomi", "QR/ultratovush orqali davomat va sababli kelmaslik", "PDF · 410 KB"],
  ["Akademik halollik siyosati", "Plagiat va nusxa ko‘chirishga qarshi choralar", "PDF · 520 KB"],
  ["Ma’lumotlar xavfsizligi", "Talaba ma’lumotlari bilan ishlash qoidalari", "PDF · 380 KB"],
];

export default function Policies() {
  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="Ish" title="Qoidalar va siyosatlar" description="Universitetning rasmiy hujjatlari." />
        <div className="mb-4"><Notice tone="gold">Namunaviy ro‘yxat: fayllar demo rejimda yuklanmaydi.</Notice></div>
        <ul className="grid gap-3 md:grid-cols-2">
          {DOCS.map(([t, d, m]) => (
            <li key={t} className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card">
              <IconChip icon={FileText} tone="navy" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">{t}</p>
                <p className="text-xs text-muted-foreground">{d}</p>
                <p className="mt-1 text-[11px] text-slate-400">{m}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-400"><Download size={16} /></span>
            </li>
          ))}
        </ul>
      </Page>
    </StaffPage>
  );
}
