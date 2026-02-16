import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global onboarding guard.
 * Checks if the user has completed registration.
 * If not, redirects to /onboarding.
 * 
 * Returns { checking: true } while loading,
 * { checking: false, completed: true } when user can proceed,
 * { checking: false, completed: false } when redirecting to onboarding.
 */
export function useOnboardingGuard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [completed, setCompleted] = useState(false);

  // Pages that don't require onboarding check
  const publicPaths = ["/auth", "/onboarding", "/callback-klavi"];
  const isPublicPath = publicPaths.some(p => location.pathname.startsWith(p));

  useEffect(() => {
    if (isPublicPath) {
      setChecking(false);
      setCompleted(true);
      return;
    }

    if (authLoading) return;

    if (!user) {
      setChecking(false);
      setCompleted(false);
      return;
    }

    let cancelled = false;

    const checkOnboarding = async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("registration_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error || !profile || !profile.registration_completed) {
          setCompleted(false);
          setChecking(false);
          navigate("/onboarding", { replace: true });
          return;
        }

        // Check user role — non-client roles (admin, supervisor, fa, kam, projetista)
        // don't need org membership since they access orgs via hierarchy
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        const role = roleData?.role;
        const isStaffRole = role && ["admin", "supervisor", "fa", "kam", "projetista"].includes(role);

        // Only require org membership for clients (or users without a role)
        if (!isStaffRole) {
          const { data: memberships } = await supabase
            .from("organization_members")
            .select("id")
            .eq("user_id", user.id)
            .limit(1);

          if (cancelled) return;

          if (!memberships || memberships.length === 0) {
            setCompleted(false);
            setChecking(false);
            navigate("/onboarding", { replace: true });
            return;
          }
        }

        setCompleted(true);
        setChecking(false);
      } catch {
        if (!cancelled) {
          setChecking(false);
          setCompleted(false);
        }
      }
    };

    checkOnboarding();

    return () => { cancelled = true; };
  }, [user, authLoading, navigate, isPublicPath, location.pathname]);

  return { checking: checking && !isPublicPath, completed };
}
