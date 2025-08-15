import { useMemo } from "react";
import { authClient } from "@/lib/auth-client";

export function useUserDisplay() {
  const { data: session } = authClient.useSession();
  const user = session?.user ?? ({} as any);
  return useMemo(() => {
    const name: string | undefined = user.name ?? user.email?.split("@")[0];
    const username: string | undefined =
      user.username ||
      (name ? name.toString().trim().toLowerCase().replace(/\s+/g, "") : undefined) ||
      user.id;
    const handle = username ? `@${username}` : "@user";
    const avatarUrl: string | undefined = user.image || user.avatarUrl;
    return { name: name || "User", handle, avatarUrl };
  }, [user]);
}
