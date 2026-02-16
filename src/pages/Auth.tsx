import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ibbraLogoFullWhite from "@/assets/ibbra-logo-full-white.png";
import ibbraLogoIcon from "@/assets/ibbra-logo-icon.png";
import RegistrationFlow from "@/components/auth/RegistrationFlow";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});
const resetPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

type AuthView = "login" | "reset_password" | "register";

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<AuthView>("login");
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Check if user has completed registration before allowing access
    const checkRegistration = async () => {
      // First ensure user is provisioned (handles cases where trigger failed)
      try { await supabase.rpc('ensure_user_provisioned'); } catch { /* ignore */ }

      const { data: profile } = await supabase
        .from("profiles")
        .select("registration_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile || !profile.registration_completed) {
        // User hasn't completed onboarding - redirect there
        navigate("/onboarding", { replace: true });
        return;
      }

      navigate("/");
    };

    checkRegistration();
  }, [user, navigate]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    setIsLoading(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login credentials")
          ? "Email ou senha incorretos"
          : "Erro ao fazer login: " + error.message
      );
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/");
    }
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setIsLoading(false);
    if (error) {
      toast.error("Erro ao enviar email: " + error.message);
    } else {
      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setView("login");
    }
  };

  const handleGoogleSignIn = async () => {
    // Use standard redirect flow (not popup) to avoid localhost redirect issues
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Always redirect to root - the onboarding guard will handle routing
        redirectTo: window.location.origin + "/",
      },
    });
    if (error) {
      toast.error("Erro ao conectar com Google: " + error.message);
    }
  };

  // ── Branding Panel (shared) ──
  const BrandingPanel = () => (
    <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden sidebar-premium">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/ibbra-grafismo.svg')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right bottom",
          backgroundSize: "85%",
          opacity: 0.08,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/ibbra-grafismo.svg')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left top",
          backgroundSize: "50%",
          opacity: 0.04,
          transform: "rotate(180deg)",
        }}
      />

      <div className="relative z-10 flex flex-col justify-between p-14 text-white/90 w-full">
        <div>
          <img src={ibbraLogoFullWhite} alt="IBBRA" className="h-9 object-contain" />
        </div>

        <div className="space-y-8 max-w-lg">
          <div className="space-y-4">
            <h2
              className="text-[2.75rem] leading-[1.1] font-semibold tracking-tight text-white"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Mais que pensar
              <br />
              em números,
              <br />
              <span className="italic font-normal text-white/70">
                pensar em você.
              </span>
            </h2>
          </div>
          <div className="w-12 h-px bg-white/20" />
          <p className="text-[15px] text-white/50 leading-relaxed max-w-sm">
            Emancipação patrimonial e estratégia familiar
            para quem constrói legado com propósito.
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-white/25 tracking-wide">
          <span>© {new Date().getFullYear()} IBBRA Family Office</span>
          <span className="uppercase tracking-widest">Wealth Strategy</span>
        </div>
      </div>
    </div>
  );

  // ── Registration View ──
  if (view === "register") {
    return (
      <div className="min-h-screen flex">
        <BrandingPanel />
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-14 bg-background">
          <div className="w-full max-w-[420px]">
            <div className="flex items-center justify-center mb-8 lg:hidden">
              <img src={ibbraLogoIcon} alt="IBBRA" className="h-12 w-auto object-contain" />
            </div>
            <RegistrationFlow
              onBack={() => setView("login")}
              onGoogleSignUp={handleGoogleSignIn}
            />
            <p className="text-center text-[11px] text-muted-foreground/50 mt-8 lg:hidden">
              © {new Date().getFullYear()} IBBRA Family Office
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset Password View ──
  if (view === "reset_password") {
    return (
      <div className="min-h-screen flex">
        <BrandingPanel />
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-14 bg-background">
          <div className="w-full max-w-[380px]">
            <div className="flex items-center justify-center mb-12 lg:hidden">
              <img src={ibbraLogoIcon} alt="IBBRA" className="h-12 w-auto object-contain" />
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Recuperar acesso
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enviaremos um link de recuperação para o email cadastrado.
                </p>
              </div>

              <Form {...resetPasswordForm}>
                <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-5">
                  <FormField
                    control={resetPasswordForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</FormLabel>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
                          <FormControl>
                            <Input placeholder="seu@email.com" className="pl-11 h-12 input-executive text-sm text-foreground" autoComplete="email" {...field} />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-12 font-semibold text-sm tracking-wide" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de recuperação"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full h-10 text-muted-foreground hover:text-foreground text-sm" onClick={() => setView("login")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao acesso
                  </Button>
                </form>
              </Form>
            </div>

            <p className="text-center text-[11px] text-muted-foreground/50 mt-12 lg:hidden">
              © {new Date().getFullYear()} IBBRA Family Office
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Login View ──
  return (
    <div className="min-h-screen flex">
      <BrandingPanel />

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-14 bg-background">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center justify-center mb-12 lg:hidden">
            <img src={ibbraLogoIcon} alt="IBBRA" className="h-12 w-auto object-contain" />
          </div>

          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Bem-vindo de volta
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Acesse sua plataforma de gestão patrimonial.
              </p>
            </div>

            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</FormLabel>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
                        <FormControl>
                          <Input placeholder="seu@email.com" className="pl-11 h-12 input-executive text-sm" autoComplete="email" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Senha</FormLabel>
                        <button type="button" className="text-[11px] text-accent hover:text-accent/80 transition-colors font-medium" onClick={() => setView("reset_password")}>
                          Esqueceu a senha?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
                        <FormControl>
                          <Input type="password" placeholder="••••••••" className="pl-11 h-12 input-executive text-sm" autoComplete="current-password" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-12 font-semibold text-sm tracking-wide" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acessar plataforma"}
                </Button>
              </form>
            </Form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            {/* Google Sign In */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-sm"
              onClick={handleGoogleSignIn}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Entrar com Google
            </Button>

            {/* Create Account */}
            <Button
              type="button"
              variant="ghost"
              className="w-full h-10 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setView("register")}
            >
              Não tem conta? <span className="ml-1 font-semibold text-accent">Criar conta</span>
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/50 mt-12 lg:hidden">
            © {new Date().getFullYear()} IBBRA Family Office
          </p>
        </div>
      </div>
    </div>
  );
}
