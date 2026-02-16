import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function checkUserBlocked(userId: string): Promise<{ blocked: boolean; reason?: string }> {
  // First check if user is individually blocked
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_blocked, blocked_reason")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (!profileError && profile?.is_blocked) {
    return { 
      blocked: true, 
      reason: profile.blocked_reason || "Seu acesso foi bloqueado. Entre em contato com o administrador."
    };
  }

  // Then check if ALL user's organizations are blocked
  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id, organizations!inner(is_blocked, blocked_reason, name)")
    .eq("user_id", userId);
  
  if (error || !memberships || memberships.length === 0) {
    return { blocked: false };
  }
  
  const blockedOrgs = memberships.filter(m => (m.organizations as any)?.is_blocked === true);
  
  if (blockedOrgs.length === memberships.length && blockedOrgs.length > 0) {
    const blockedOrg = blockedOrgs[0].organizations as any;
    return { 
      blocked: true, 
      reason: blockedOrg.blocked_reason || `A organização ${blockedOrg.name} está bloqueada.`
    };
  }
  
  return { blocked: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastBlockedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const runBlockedCheck = (maybeSession: Session | null) => {
      const u = maybeSession?.user;
      if (!u) return;

      // Defer Supabase calls to avoid deadlocks inside auth event loop
      setTimeout(async () => {
        if (!isMounted) return;

        // Avoid spamming toasts / loops for the same user id
        if (lastBlockedUserIdRef.current === u.id) return;

        // Handle IBBRA registration data for Google OAuth signups
        const provider = u.app_metadata?.provider;
        if (provider === 'google') {
          const createdAt = new Date(u.created_at).getTime();
          const now = Date.now();
          // If the account was created less than 60 seconds ago, process registration data
          if (now - createdAt < 60000) {
            const regDataStr = localStorage.getItem("ibbra_registration");
            if (regDataStr) {
              try {
                const regData = JSON.parse(regDataStr);
                localStorage.removeItem("ibbra_registration");
                // Update profile with IBBRA data
                await supabase.from("profiles").update({
                  is_ibbra_client: regData.isIbbraClient || false,
                  cpf: regData.cpf || null,
                  full_name: regData.fullName || u.user_metadata?.full_name || null,
                  birth_date: regData.birthDate || null,
                  external_client_validated: regData.validated || false,
                  validated_at: regData.validated ? new Date().toISOString() : null,
                }).eq("user_id", u.id);
              } catch (e) {
                console.warn("Error processing IBBRA registration data:", e);
                localStorage.removeItem("ibbra_registration");
              }
            }
          }
        }

        const { blocked, reason } = await checkUserBlocked(u.id);
        if (!isMounted) return;

        if (blocked) {
          lastBlockedUserIdRef.current = u.id;
          toast.error(reason || "Sua organização está bloqueada. Entre em contato com o administrador.");
          await supabase.auth.signOut();
          if (!isMounted) return;
          setSession(null);
          setUser(null);
        }
      }, 0);
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Synchronous updates only
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      runBlockedCheck(nextSession);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!isMounted) return;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);

      runBlockedCheck(existingSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { error: error as Error | null };
    }
    
    // Check if user's organization is blocked
    if (data.user) {
      const { blocked, reason } = await checkUserBlocked(data.user.id);
      
      if (blocked) {
        await supabase.auth.signOut();
        return { error: new Error(reason || "Sua organização está bloqueada. Entre em contato com o administrador.") };
      }
    }
    
    return { error: null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // Clear any local state
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
      // Force clear state even on error
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
