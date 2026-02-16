import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useOnboardingGuard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [completed, setCompleted] = useState(false);

  const publicPaths = ["/auth", "/onboarding", "/callback-klavi", "/termos-de-uso", "/politica-de-privacidade", "/lgpd", "/consent-reaccept"];
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
          .select("registration_completed, legal_accepted")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error || !profile || !profile.registration_completed) {
          setCompleted(false);
          setChecking(false);
          navigate("/onboarding", { replace: true });
          return;
        }

        // Check legal consent - if registration is done but legal not accepted, redirect to consent
        if (!profile.legal_accepted) {
          // Check if consent is outdated (new version published)
          const { data: isValid } = await supabase.rpc("check_user_consent_valid", { p_user_id: user.id });
          
          if (cancelled) return;

          if (!isValid) {
            setCompleted(false);
            setChecking(false);
            navigate("/consent-reaccept", { replace: true });
            return;
          }

          // If consent is valid but flag not set, update it
          await supabase
            .from("profiles")
            .update({ legal_accepted: true })
            .eq("user_id", user.id);
        } else {
          // Even if legal_accepted is true, check version freshness
          const { data: isValid } = await supabase.rpc("check_user_consent_valid", { p_user_id: user.id });

          if (cancelled) return;

          if (isValid === false) {
            // New version published, force reaccept
            await supabase
              .from("profiles")
              .update({ legal_accepted: false })
              .eq("user_id", user.id);

            setCompleted(false);
            setChecking(false);
            navigate("/consent-reaccept", { replace: true });
            return;
          }
        }

        // Check user role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        const role = roleData?.role;
        const isStaffRole = role && ["admin", "supervisor", "fa", "kam", "projetista"].includes(role);

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
