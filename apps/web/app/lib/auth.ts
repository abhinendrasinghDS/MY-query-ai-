"use client";

import { useEffect, useState } from "react";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: "google" | "email" | "demo";
  role?: string;
};

const STORAGE_KEY = "myquery_user_session";

export function getStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserProfile | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
    setLoading(false);
  }, []);

  const loginWithGoogle = (customEmail?: string, customName?: string, customAvatar?: string) => {
    const googleUser: UserProfile = {
      id: "g_" + Math.random().toString(36).substring(2, 9),
      name: customName || "Google User",
      email: customEmail || "user@gmail.com",
      avatar: customAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
      provider: "google",
      role: "Database Analyst"
    };
    setStoredUser(googleUser);
    setUser(googleUser);
    return googleUser;
  };

  const loginWithEmail = (email: string, name?: string) => {
    const emailUser: UserProfile = {
      id: "u_" + Math.random().toString(36).substring(2, 9),
      name: name || email.split("@")[0],
      email: email,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
      provider: "email",
      role: "Database Analyst"
    };
    setStoredUser(emailUser);
    setUser(emailUser);
    return emailUser;
  };

  const loginDemo = () => {
    const demoUser: UserProfile = {
      id: "demo_guest",
      name: "Guest Analyst",
      email: "guest@myquery.ai",
      avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80",
      provider: "demo",
      role: "Guest Explorer"
    };
    setStoredUser(demoUser);
    setUser(demoUser);
    return demoUser;
  };

  const logout = () => {
    setStoredUser(null);
    setUser(null);
  };

  return { user, loading, loginWithGoogle, loginWithEmail, loginDemo, logout };
}
