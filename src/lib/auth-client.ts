import { createAuthClient } from "better-auth/react";
import { siweClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_BASE_URL,
  plugins: [siweClient()],
});

export const { signIn, signUp, useSession, signOut } = authClient;
