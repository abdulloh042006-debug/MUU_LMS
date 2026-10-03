"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api-service";
type User = { id: string; username: string; email: string; [key: string]: any };
type Auth = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  connectionStatus: "checking" | "connected" | "disconnected" | "offline";
  isOfflineMode: boolean;
  login: (u: string, p: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  retryConnection: () => Promise<void>;
  reloadUser: () => Promise<void>;
};
const Context = createContext<Auth | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [isLoading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [connectionStatus, setStatus] =
    useState<Auth["connectionStatus"]>("checking");
  const router = useRouter();
  const retryConnection = async () => {
    setStatus(
      (await api.testConnection()).success ? "connected" : "disconnected",
    );
  };
  const reloadUser = async () => {
    setUser(await api.getUserProfile());
  };
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (localStorage.getItem("lms-token")) await reloadUser();
      } catch {
        localStorage.removeItem("lms-token");
        localStorage.removeItem("lms-refresh");
      } finally {
        if (active) setLoading(false);
      }
    })();
    retryConnection();
    return () => {
      active = false;
    };
  }, []);
  const authenticate = async (request: () => Promise<any>) => {
    setLoading(true);
    setError(null);
    try {
      const data = await request();
      localStorage.setItem("lms-token", data.access);
      localStorage.setItem("lms-refresh", data.refresh);
      await reloadUser();
      router.push("/dashboard");
    } catch (e) {
      localStorage.removeItem("lms-token");
      localStorage.removeItem("lms-refresh");
      setUser(null);
      setError(e instanceof Error ? e.message : "Unable to sign in");
      throw e;
    } finally {
      setLoading(false);
    }
  };
  const logout = () => {
    localStorage.removeItem("lms-token");
    localStorage.removeItem("lms-refresh");
    setUser(null);
    router.push("/login");
  };
  return (
    <Context.Provider
      value={{
        user,
        isLoading,
        error,
        connectionStatus,
        isOfflineMode: false,
        login: (u, p) => authenticate(() => api.login(u, p)),
        register: (data) => authenticate(() => api.register(data)),
        logout,
        clearError: () => setError(null),
        retryConnection,
        reloadUser,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("AuthProvider required");
  return context;
}
