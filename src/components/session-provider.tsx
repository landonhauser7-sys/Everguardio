"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  teamId: string | null;
  teamName: string | null;
  profilePhotoUrl: string | null;
  commissionLevel: number | null;
}

interface Session {
  user: SessionUser;
  expires: string;
}

interface SessionContextValue {
  data: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
  update: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  data: null,
  status: "loading",
  update: async () => {},
});

export function useSession() {
  const context = useContext(SessionContext);
  return context;
}

export async function signOut(options?: { callbackUrl?: string }) {
  try {
    await fetch("/api/auth/signout", { method: "POST" });
  } catch (e) {
    console.error("Sign out error:", e);
  }
  window.location.href = options?.callbackUrl || "/login";
}

interface SessionProviderProps {
  children: ReactNode;
}

export function CustomSessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setSession(data);
          setStatus("authenticated");
        } else {
          setSession(null);
          setStatus("unauthenticated");
        }
      } else {
        setSession(null);
        setStatus("unauthenticated");
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
      setSession(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return (
    <SessionContext.Provider value={{ data: session, status, update: fetchSession }}>
      {children}
    </SessionContext.Provider>
  );
}
