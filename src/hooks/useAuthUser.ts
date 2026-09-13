import { useEffect, useState } from "react";
import { CloudSync } from "../services/cloud/CloudSyncService";
import type { AuthUser } from "../services/cloud/types";

export function useAuthUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(() => CloudSync.getUser());

  useEffect(() => {
    setUser(CloudSync.getUser());
    return CloudSync.subscribe(() => setUser(CloudSync.getUser()));
  }, []);

  return user;
}
