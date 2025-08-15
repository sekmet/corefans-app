import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";

export function useRequireAuth() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/login", { replace: true, state: { from: location } });
    }
  }, [isPending, session, navigate, location]);

  return { session, isPending } as const;
}
