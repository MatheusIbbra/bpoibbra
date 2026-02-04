import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Loader2, KeyRound, ArrowLeft, Shield, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres")
});
const resetPasswordSchema = z.object({
  email: z.string().email("Email inválido")
});
type LoginFormData = z.infer<typeof loginSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const {
    user,
    signIn
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });
  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: ""
    }
  });
  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    const {
      error
    } = await signIn(data.email, data.password);
    setIsLoading(false);
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Email ou senha incorretos");
      } else {
        toast.error("Erro ao fazer login: " + error.message);
      }
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/");
    }
  };
  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    const {
      error
    } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth`
    });
    setIsLoading(false);
    if (error) {
      toast.error("Erro ao enviar email: " + error.message);
    } else {
      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setShowResetPassword(false);
    }
  };
  if (showResetPassword) {
    return <div className="min-h-screen flex">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden sidebar-premium">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          <div className="relative z-10 flex flex-col justify-between p-12 text-sidebar-foreground">
            <div className="flex items-center gap-4">
              <img src="/ibbra-logo.jpeg" alt="Ibbra" className="h-14 w-auto rounded-xl object-contain shadow-lg" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Ibbra</h1>
                <p className="text-sm text-sidebar-muted">Financial Management</p>
              </div>
            </div>
            
            <div className="space-y-8">
              <div>
                <h2 className="text-4xl font-bold tracking-tight leading-tight mb-4">
                  Gestão Financeira<br />Inteligente
                </h2>
                <p className="text-lg text-sidebar-muted max-w-md leading-relaxed">
                  Plataforma executiva para controle completo de suas finanças corporativas 
                  com análises estratégicas e relatórios personalizados.
                </p>
              </div>
              
              <div className="flex items-center gap-6 text-sm text-sidebar-muted">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-accent" />
                  <span>Segurança Avançada</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  <span>Multi-Empresa</span>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-sidebar-muted">
              © 2025 Ibbra. Todos os direitos reservados.
            </p>
          </div>
        </div>

        {/* Right Panel - Reset Form */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
              <img src="/ibbra-logo.jpeg" alt="Ibbra" className="h-12 w-auto rounded-xl object-contain shadow-md" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">Ibbra</h1>
                <p className="text-xs text-muted-foreground">Financial Management</p>
              </div>
            </div>

            <Card className="border-0 shadow-executive-lg">
              <CardHeader className="space-y-1 pb-6">
                <CardTitle className="text-2xl font-bold tracking-tight text-center">
                  Recuperar Senha
                </CardTitle>
                <CardDescription className="text-center text-muted-foreground">
                  Digite seu email para receber o link de recuperação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...resetPasswordForm}>
                  <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-5">
                    <FormField control={resetPasswordForm.control} name="email" render={({
                    field
                  }) => <FormItem>
                          <FormLabel className="text-sm font-medium">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input placeholder="seu@email.com" className="pl-11 h-12 input-executive" autoComplete="email" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>} />
                    <Button type="submit" className="w-full h-12 font-semibold shadow-md hover:shadow-lg transition-all duration-200" disabled={isLoading}>
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar Email de Recuperação"}
                    </Button>
                    <Button type="button" variant="ghost" className="w-full h-11 text-muted-foreground hover:text-foreground" onClick={() => setShowResetPassword(false)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar ao login
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>;
  }
  return <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden sidebar-premium">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-sidebar-foreground">
          <div className="flex items-center gap-4">
            <img src="/ibbra-logo.jpeg" alt="Ibbra" className="h-14 w-auto rounded-xl object-contain shadow-lg" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ibbra</h1>
              <p className="text-sm text-sidebar-muted">Financial Management</p>
            </div>
          </div>
          
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold tracking-tight leading-tight mb-4">
                Gestão Financeira<br />Inteligente
              </h2>
              <p className="text-lg text-sidebar-muted max-w-md leading-relaxed">
                Plataforma executiva para controle completo de suas finanças corporativas 
                com análises estratégicas e relatórios personalizados.
              </p>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-sidebar-muted">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent" />
                <span>Segurança Avançada</span>
              </div>
              <div className="flex items-center gap-2">
                
                
              </div>
            </div>
          </div>
          
          <p className="text-xs text-sidebar-muted">
            © 2025 Ibbra. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
            <img src="/ibbra-logo.jpeg" alt="Ibbra" className="h-12 w-auto rounded-xl object-contain shadow-md" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Ibbra</h1>
              <p className="text-xs text-muted-foreground">Financial Management</p>
            </div>
          </div>

          <Card className="border-0 shadow-executive-lg">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold tracking-tight text-center">
                Bem-vindo de volta
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground">
                Entre com suas credenciais para acessar o sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                  <FormField control={loginForm.control} name="email" render={({
                  field
                }) => <FormItem>
                        <FormLabel className="text-sm font-medium">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input placeholder="seu@email.com" className="pl-11 h-12 input-executive" autoComplete="email" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>} />
                  <FormField control={loginForm.control} name="password" render={({
                  field
                }) => <FormItem>
                        <FormLabel className="text-sm font-medium">Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="password" placeholder="••••••••" className="pl-11 h-12 input-executive" autoComplete="current-password" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>} />
                  <Button type="submit" className="w-full h-12 font-semibold shadow-md hover:shadow-lg transition-all duration-200" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">ou</span>
                    </div>
                  </div>
                  
                  <Button type="button" variant="ghost" className="w-full h-11 text-muted-foreground hover:text-foreground" onClick={() => setShowResetPassword(true)}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Esqueci minha senha
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <p className="text-center text-xs text-muted-foreground mt-6 lg:hidden">
            © 2025 Ibbra. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>;
}