"use client";

import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { Notice, Page } from "@/components/mu/kit";

/** Faqat ustoz/admin uchun sahifa o‘rami. */
export function StaffPage({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Gate>{children}</Gate>
    </ProtectedRoute>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && user.role === "student")
    return (
      <Page>
        <Notice tone="amber">Bu bo‘lim faqat o‘qituvchilar uchun.</Notice>
      </Page>
    );
  return <>{children}</>;
}

export const DEMO_ONLY_NOTE = "Bu bo‘lim hozircha faqat demo rejimda ishlaydi; haqiqiy serverga ulanganda backend moduli kerak bo‘ladi.";
