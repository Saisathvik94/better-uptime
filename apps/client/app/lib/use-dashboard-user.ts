"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export function useDashboardUser() {
  const [token] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("token"),
  );
  const me = trpc.user.me.useQuery(undefined, { enabled: !!token });
  const data = me.data;
  const displayName =
    data?.name?.trim() ||
    (data?.email ? data.email.split("@")[0] : null) ||
    "User";
  const displayEmail = data?.email ?? "—";
  return {
    displayName,
    displayEmail,
    avatarUrl: data?.avatarUrl ?? null,
    isLoading: me.isLoading,
  };
}
