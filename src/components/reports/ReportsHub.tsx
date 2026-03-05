import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Receipt,
  CircleDollarSign,
  PieChart,
  BarChart3,
  FileText,
  Layers,
  Tags,
} from "lucide-react";

const reportCards = [
  {
    title: "Movimentações",
    description: "Todas as entradas e saídas",
    icon: Receipt,
    tab: "movimentacoes",
    color: "210 100% 36%",
  },
  {
    title: "Fluxo de Caixa",
    description: "Entradas vs saídas por período",
    icon: CircleDollarSign,
    tab: "fluxo",
    color: "160 60% 36%",
  },
  {
    title: "DRE",
    description: "Resultado do exercício",
    icon: PieChart,
    tab: "dre",
    color: "213 80% 13%",
  },
  {
    title: "Orçamento",
    description: "Planejado vs realizado",
    icon: BarChart3,
    tab: "analise",
    color: "38 92% 50%",
  },
  {
    title: "Demonstrativo",
    description: "Relatório financeiro completo",
    icon: FileText,
    tab: "demonstrativo",
    color: "14 100% 54%",
  },
  {
    title: "Tipo Financeiro",
    description: "Análise por classificação",
    icon: Layers,
    tab: "tipo-financeiro",
    color: "210 85% 55%",
  },
  {
    title: "Categorias",
    description: "Análise detalhada por categoria",
    icon: Tags,
    tab: "categorias",
    color: "160 55% 40%",
  },
];

export function ReportsHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Relatórios</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o relatório que deseja visualizar
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {reportCards.map((card, index) => (
          <motion.button
            key={card.tab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            onClick={() => navigate(`/relatorios?tab=${card.tab}`)}
            className="flex flex-col items-start p-4 bg-card rounded-[20px] border border-border/30 shadow-fintech text-left transition-all duration-300 active:scale-[0.97] hover:shadow-fintech-lg group"
          >
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110"
              style={{
                backgroundColor: `hsl(${card.color} / 0.1)`,
              }}
            >
              <card.icon
                className="h-5 w-5"
                style={{ color: `hsl(${card.color})` }}
                strokeWidth={1.8}
              />
            </div>
            <span className="text-sm font-semibold text-foreground leading-tight">
              {card.title}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {card.description}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
