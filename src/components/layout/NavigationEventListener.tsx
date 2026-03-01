import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function NavigationEventListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e: CustomEvent) => navigate(e.detail.path);
    window.addEventListener("navigate-to", handler as EventListener);
    return () => window.removeEventListener("navigate-to", handler as EventListener);
  }, [navigate]);
  return null;
}
