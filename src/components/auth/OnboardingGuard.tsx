import { Loader2 } from "lucide-react";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * Wraps all routes to enforce onboarding completion.
 * Shows a loader while checking, renders children when allowed.
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { checking } = useOnboardingGuard();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
