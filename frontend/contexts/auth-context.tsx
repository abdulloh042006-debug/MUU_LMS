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
  logout: () => Promise<void>;
  clearError: () => void;
  retryConnection: () => Promise<void>;
  reloadUser: () => Promise<void>;
};

const Context = createContext<Auth | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        await api.restoreSession();
        const profile = await api.getUserProfile();
        if (active) setUser(profile);
      } catch {
        api.clearAccessToken();
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    void retryConnection();
    return () => {
      active = false;
    };
  }, []);

  const authenticate = async (request: () => Promise<any>) => {
    setLoading(true);
    setError(null);
    try {
      const data = await request();
      api.setAccessToken(data.access);
      const profile = await api.getUserProfile();
      setUser(profile);
      router.push(profile.must_change_password ? "/profile?change-password=1" : "/dashboard");
    } catch (e) {
      api.clearAccessToken();
      setUser(null);
      setError(e instanceof Error ? e.message : "Tizimga kirib bo‘lmadi.");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logoutSession();
    } catch {
      api.clearAccessToken();
    } finally {
      setUser(null);
      router.push("/login");
    }
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
