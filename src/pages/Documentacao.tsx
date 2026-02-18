import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Download, 
  Brain, 
  Users, 
  Database, 
  Upload,
  CheckCircle2,
  ArrowDown,
  Shield,
  Building2,
  Zap,
  Scale,
  Sparkles
} from "lucide-react";

export default function Documentacao() {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background p-8 print:p-4">
      {/* Print Button - Hidden when printing */}
      <div className="fixed top-4 right-4 print:hidden z-50">
        <Button onClick={handlePrint} disabled={printing}>
          <Download className="h-4 w-4 mr-2" />
          {printing ? "Preparando..." : "Exportar PDF"}
        </Button>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <img 
              src="/ibbra-logo.jpeg" 
              alt="Ibbra" 
              className="h-16 w-16 rounded-lg object-contain"
            />
            <div>
              <h1 className="text-4xl font-bold" style={{ color: '#011e40' }}>IBBRA</h1>
              <p className="text-lg text-muted-foreground">Sistema de Gestão Financeira Multi-Tenant</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Documentação Técnica v9.0 • Fevereiro 2026</p>
        </div>

        <Separator />

        {/* 1. Arquitetura Multi-Tenant */}
        <Card className="print:break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: '#011e40' }} />
              1. Arquitetura Multi-Tenant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cada cliente possui uma "Base" (organização) com isolamento total de dados via RLS.
            </p>
            <div className="flex justify-center">
              <div className="border rounded-lg p-4 bg-muted/30 text-center">
                <div className="font-mono text-xs space-y-2">
                  <div className="border-2 border-primary/30 rounded p-2">ORGANIZAÇÕES</div>
                  <div className="flex justify-center gap-4">
                    <div className="border rounded p-2">Base A</div>
                    <div className="border rounded p-2">Base B</div>
                    <div className="border rounded p-2">Base C</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Hierarquia de Usuários */}
        <Card className="print:break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" style={{ color: '#011e40' }} />
              2. Hierarquia de Usuários (5 Níveis)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { role: "ADMIN", desc: "Gestão total do sistema", color: "bg-primary/10 text-primary" },
                { role: "SUPERVISOR", desc: "Validação e qualidade", color: "bg-purple-100 text-purple-700" },
                { role: "FA", desc: "Financial Analyst - Classificação", color: "bg-blue-100 text-blue-700" },
                { role: "KAM", desc: "Key Account Manager - Relacionamento", color: "bg-emerald-100 text-emerald-700" },
                { role: "CLIENTE", desc: "Upload e visualização restrita", color: "bg-orange-100 text-orange-700" },
              ].map((item, i) => (
                <div key={item.role} className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded font-mono text-xs font-bold ${item.color}`}>
                    {item.role}
                  </div>
                  <span className="text-sm text-muted-foreground">→ {item.desc}</span>
                  {i < 4 && <ArrowDown className="h-3 w-3 text-muted-foreground ml-auto" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 3. Fluxo de Importação */}
        <Card className="print:break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" style={{ color: '#011e40' }} />
              3. Fluxo de Importação (9 Etapas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                "1. Upload (OFX/CSV/PDF)",
                "2. Validação de formato",
                "3. Armazenamento Storage",
                "4. Criação do lote",
                "5. Parse + Hash SHA-256",
                "6. Inserir transações",
                "7. Classificação automática",
                "8. Conclusão do lote",
                "9. Notificação usuário",
              ].map((step, i) => (
                <div key={i} className="border rounded p-2 text-center bg-muted/30">
                  {step}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Motor de Conciliação */}
        <Card className="print:break-inside-avoid print:break-before-page">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" style={{ color: '#011e40' }} />
              4. Motor de Conciliação Automática
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pipeline fixo de classificação com auto-aprendizado contínuo.
            </p>
            
            <div className="space-y-3">
              {/* Step 1 - Normalization */}
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">1</div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Normalização</p>
                  <p className="text-xs text-muted-foreground">lowercase, sem acentos, sem números, sem stopwords</p>
                </div>
              </div>

              {/* Step 2 - Rules */}
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Scale className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Regras de Conciliação</p>
                  <p className="text-xs text-muted-foreground">Match ≥ 80% → AUTO-VALIDADO</p>
                </div>
                <div className="text-xs font-mono bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">rule</div>
              </div>

              {/* Step 3 - Patterns */}
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Padrões Aprendidos</p>
                  <p className="text-xs text-muted-foreground">Confidence ≥ 85% + 3 ocorrências → AUTO-VALIDADO</p>
                </div>
                <div className="text-xs font-mono bg-green-100 dark:bg-green-900 px-2 py-1 rounded">pattern</div>
              </div>

              {/* Step 4 - AI */}
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">IA (Fallback)</p>
                  <p className="text-xs text-muted-foreground">NUNCA auto-valida → vai para Pendências</p>
                </div>
                <div className="text-xs font-mono bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded">ai</div>
              </div>
            </div>

            {/* Learning Loop */}
            <div className="border-2 border-dashed rounded-lg p-4 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Aprendizado Contínuo</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cada validação humana atualiza <code className="bg-muted px-1 rounded">transaction_patterns</code>:
                incrementa ocorrências, recalcula valor médio, aumenta confiança.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Tabelas Principais */}
        <Card className="print:break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" style={{ color: '#011e40' }} />
              5. Estrutura de Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                "organizations",
                "profiles",
                "user_roles",
                "user_hierarchy",
                "accounts",
                "categories",
                "cost_centers",
                "transactions",
                "transfers",
                "budgets",
                "reconciliation_rules",
                "transaction_patterns",
                "import_batches",
                "ai_suggestions",
                "audit_log",
                "organization_members",
              ].map((table) => (
                <div key={table} className="font-mono bg-muted/50 px-2 py-1 rounded">
                  {table}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 6. Segurança */}
        <Card className="print:break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: '#011e40' }} />
              6. Segurança e Isolamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>RLS (Row Level Security) em todas as tabelas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Função <code className="bg-muted px-1 rounded text-xs">get_viewable_organizations()</code> controla acesso</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Audit log para todas ações administrativas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Bloqueio de usuários e organizações</span>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Separator className="mb-4" />
          <p>IBBRA - Sistema de Gestão Financeira Multi-Tenant</p>
          <p>Documentação gerada automaticamente • v9.0</p>
          <div className="flex justify-center gap-3 mt-3">
            <a href="/docs/IBBRA-SYSTEM-DOCUMENTATION-V9.md" target="_blank" className="text-xs text-accent underline hover:no-underline">Documentação Completa (Markdown)</a>
            <span className="text-xs text-muted-foreground">•</span>
            <a href="/docs/IBBRA-RECREATION-PROMPT-V8.md" target="_blank" className="text-xs text-accent underline hover:no-underline">Prompt de Recriação</a>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:break-inside-avoid {
            break-inside: avoid;
          }
          .print\\:break-before-page {
            break-before: page;
          }
        }
      `}</style>
    </div>
  );
}
