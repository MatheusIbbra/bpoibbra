import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowUpDown, BarChart3, FileText, PieChart, CircleDollarSign } from "lucide-react";

export default function Relatorios() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("extrato");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <AppLayout title="Relatórios">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap gap-1">
          <TabsTrigger value="extrato" className="gap-2 data-[state=active]:bg-background text-xs sm:text-sm">
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">Extrato</span>
          </TabsTrigger>
          <TabsTrigger value="analise" className="gap-2 data-[state=active]:bg-background text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Análise Orçamento</span>
          </TabsTrigger>
          <TabsTrigger value="dre" className="gap-2 data-[state=active]:bg-background text-xs sm:text-sm">
            <PieChart className="h-4 w-4" />
            <span className="hidden sm:inline">DRE</span>
          </TabsTrigger>
          <TabsTrigger value="demonstrativo" className="gap-2 data-[state=active]:bg-background text-xs sm:text-sm">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Demonstrativo</span>
          </TabsTrigger>
          <TabsTrigger value="fluxo" className="gap-2 data-[state=active]:bg-background text-xs sm:text-sm">
            <CircleDollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Fluxo de Caixa</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="extrato" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Extrato de Movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Visualize todas as movimentações financeiras em formato de tabela.
              </p>
              <Button onClick={() => handleNavigate("/extrato")}>
                Abrir Extrato Completo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analise" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Análise Planejado vs Realizado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Compare seus orçamentos planejados com os valores realizados.
              </p>
              <Button onClick={() => handleNavigate("/analise-orcamento")}>
                Abrir Análise de Orçamento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="dre" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                DRE - Demonstrativo de Resultado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Visualize o demonstrativo de resultado do exercício.
              </p>
              <Button onClick={() => handleNavigate("/dre")}>
                Abrir DRE
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="demonstrativo" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Demonstrativo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Relatório detalhado por categoria com hierarquia.
              </p>
              <Button onClick={() => handleNavigate("/demonstrativo-financeiro")}>
                Abrir Demonstrativo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="fluxo" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4" />
                Fluxo de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Acompanhe a evolução do seu saldo ao longo do tempo.
              </p>
              <Button onClick={() => handleNavigate("/fluxo-caixa")}>
                Abrir Fluxo de Caixa
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
