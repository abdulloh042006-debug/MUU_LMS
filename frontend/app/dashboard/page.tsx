"use client";
import { LMSDashboard } from "@/components/lms-dashboard";
import { TeacherHome } from "@/components/teacher-home";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
export default function Dashboard() {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {user?.role === "ustoz" || user?.role === "admin" ? (
        <TeacherHome />
      ) : (
        <LMSDashboard />
      )}
    </ProtectedRoute>
  );
}
