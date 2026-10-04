"use client";

import type React from "react";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usePathname, useRouter } from "next/navigation";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (
      !isLoading &&
      user?.must_change_password &&
      pathname !== "/profile"
    ) {
      router.replace("/profile?change-password=1");
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yuklanmoqda…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (user.must_change_password && pathname !== "/profile") return null;

  return <>{children}</>;
}
