"use client";

import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { Notice, Page } from "@/components/mu/kit";

export function AdminPage({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Gate>{children}</Gate>
    </ProtectedRoute>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== "admin")
    return (
      <Page>
        <Notice tone="amber">Bu bo‘lim faqat administrator uchun.</Notice>
      </Page>
    );
  return <>{children}</>;
}
