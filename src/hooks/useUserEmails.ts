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
      const { data, error } = await supabase.functions.invoke("get-user-emails");

      if (error) {
        console.error("Error fetching user emails:", error);
        return {} as Record<string, string>;
      }

      return (data?.emails || {}) as Record<string, string>;
    },
    enabled: !!user && isAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
