import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowUpDown, BarChart3, FileText, PieChart, CircleDollarSign } from "lucide-react";

// Inline report components
import { ExtratoContent } from "@/components/reports/ExtratoContent";
import { AnaliseOrcamentoContent } from "@/components/reports/AnaliseOrcamentoContent";
import { DREContent } from "@/components/reports/DREContent";
import { DemonstrativoContent } from "@/components/reports/DemonstrativoContent";
import { FluxoCaixaContent } from "@/components/reports/FluxoCaixaContent";

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

  return (
    <AppLayout title="Relatórios">
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap gap-1">
            <TabsTrigger value="extrato" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
              Extrato
            </TabsTrigger>
            <TabsTrigger value="analise" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              Orçamento
            </TabsTrigger>
            <TabsTrigger value="dre" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <PieChart className="h-3.5 w-3.5 shrink-0" />
              DRE
            </TabsTrigger>
            <TabsTrigger value="demonstrativo" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              Demonstrativo
            </TabsTrigger>
            <TabsTrigger value="fluxo" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <CircleDollarSign className="h-3.5 w-3.5 shrink-0" />
              Fluxo Caixa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extrato" className="mt-4">
            <ExtratoContent />
          </TabsContent>
          
          <TabsContent value="analise" className="mt-4">
            <AnaliseOrcamentoContent />
          </TabsContent>
          
          <TabsContent value="dre" className="mt-4">
            <DREContent />
          </TabsContent>
          
          <TabsContent value="demonstrativo" className="mt-4">
            <DemonstrativoContent />
          </TabsContent>
          
          <TabsContent value="fluxo" className="mt-4">
            <FluxoCaixaContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
