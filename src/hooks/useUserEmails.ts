import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useUserRoles";

export function useUserEmails() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ["user-emails"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-user-emails");

        if (error) {
          console.error("Error fetching user emails:", error);
          return {} as Record<string, string>;
        }

        return (data?.emails || {}) as Record<string, string>;
      } catch (e) {
        console.error("Exception fetching user emails:", e);
        return {} as Record<string, string>;
      }
    },
    enabled: !!user && isAdmin === true,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
