import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ibbraLogoFullWhite from "@/assets/ibbra-logo-full-white.png";
import ibbraLogoIcon from "@/assets/ibbra-logo-icon.png";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});
const resetPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/");
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
      setShowResetPassword(false);
    }
  };

  // ── Branding Panel (shared between login & reset) ──
  const BrandingPanel = () => (
    <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden sidebar-premium">
      {/* Guilloché background */}
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
      {/* Secondary guilloché - top left */}
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
        {/* Logo */}
        <div>
          <img
            src={ibbraLogoFullWhite}
            alt="IBBRA"
            className="h-9 object-contain"
          />
        </div>

        {/* Institutional message */}
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

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-white/25 tracking-wide">
          <span>© {new Date().getFullYear()} IBBRA Family Office</span>
          <span className="uppercase tracking-widest">Wealth Strategy</span>
        </div>
      </div>
    </div>
  );

  // ── Reset Password View ──
  if (showResetPassword) {
    return (
      <div className="min-h-screen flex">
        <BrandingPanel />

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-14 bg-background">
          <div className="w-full max-w-[380px]">
            {/* Mobile logo */}
            <div className="flex items-center justify-center mb-12 lg:hidden">
              <img src={ibbraLogoIcon} alt="IBBRA" className="h-12 w-auto object-contain" />
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <h1
                  className="text-2xl font-semibold tracking-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
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
                        <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Email
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                            <Input
                              placeholder="seu@email.com"
                              className="pl-11 h-12 input-executive text-sm"
                              autoComplete="email"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 font-semibold text-sm tracking-wide"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Enviar link de recuperação"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-10 text-muted-foreground hover:text-foreground text-sm"
                    onClick={() => setShowResetPassword(false)}
                  >
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
          {/* Mobile logo */}
          <div className="flex items-center justify-center mb-12 lg:hidden">
            <img src={ibbraLogoIcon} alt="IBBRA" className="h-12 w-auto object-contain" />
          </div>

          <div className="space-y-8">
            <div className="space-y-2">
              <h1
                className="text-2xl font-semibold tracking-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
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
                      <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Email
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                          <Input
                            placeholder="seu@email.com"
                            className="pl-11 h-12 input-executive text-sm"
                            autoComplete="email"
                            {...field}
                          />
                        </div>
                      </FormControl>
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
                        <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Senha
                        </FormLabel>
                        <button
                          type="button"
                          className="text-[11px] text-accent hover:text-accent/80 transition-colors font-medium"
                          onClick={() => setShowResetPassword(true)}
                        >
                          Esqueceu a senha?
                        </button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                          <Input
                            type="password"
                            placeholder="••••••••"
                            className="pl-11 h-12 input-executive text-sm"
                            autoComplete="current-password"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 font-semibold text-sm tracking-wide"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Acessar plataforma"
                  )}
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
