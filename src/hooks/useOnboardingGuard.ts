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

    // Block access if email not confirmed
    if (!user.email_confirmed_at) {
      setChecking(false);
      setCompleted(false);
      navigate("/auth", { replace: true });
      return;
    }

    let cancelled = false;

    const STAFF_ROLES = ["admin", "supervisor", "fa", "kam", "projetista"];

    const checkOnboarding = async () => {
      try {
        // 1. Check role FIRST — staff bypass all onboarding/consent checks
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        const role = roleData?.role as string | null;
        const isStaffRole = role !== null && STAFF_ROLES.includes(role);

        // Staff users get immediate access — no registration or consent checks
        if (isStaffRole) {
          setCompleted(true);
          setChecking(false);
          return;
        }

        // 2. For clients: check profile registration
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

        // 3. Check legal consent freshness (clients only)
        if (!profile.legal_accepted) {
          const { data: isValid } = await supabase.rpc("check_user_consent_valid", { p_user_id: user.id });
          if (cancelled) return;
          if (!isValid) {
            setCompleted(false);
            setChecking(false);
            navigate("/consent-reaccept", { replace: true });
            return;
          }
          await supabase.from("profiles").update({ legal_accepted: true }).eq("user_id", user.id);
        } else {
          const { data: isValid } = await supabase.rpc("check_user_consent_valid", { p_user_id: user.id });
          if (cancelled) return;
          if (isValid === false) {
            await supabase.from("profiles").update({ legal_accepted: false }).eq("user_id", user.id);
            setCompleted(false);
            setChecking(false);
            navigate("/consent-reaccept", { replace: true });
            return;
          }
        }

        // 4. Check organization membership (clients only)
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

        setCompleted(true);
        setChecking(false);
      } catch (err) {
        console.error("[OnboardingGuard] error:", err);
        if (!cancelled) {
          // Fail-open: allow access on unexpected errors
          setChecking(false);
          setCompleted(true);
        }
      }
    };

    checkOnboarding();

    return () => { cancelled = true; };
  }, [user, authLoading, navigate, isPublicPath, location.pathname]);

  return { checking: checking && !isPublicPath, completed };
}
