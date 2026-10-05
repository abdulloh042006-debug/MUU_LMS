"use client";
import { LMSDashboard } from "@/components/lms-dashboard";
import { TeacherHome } from "@/components/teacher-home";
import { AdminDashboard } from "@/components/admin-dashboard";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
export default function Dashboard() {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {user?.role === "admin" ? (
        <AdminDashboard />
      ) : user?.role === "ustoz" ? (
        <TeacherHome />
      ) : (
        <LMSDashboard />
      )}
    </ProtectedRoute>
  );
}
