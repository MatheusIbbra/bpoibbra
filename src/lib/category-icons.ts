// Auto-detect icon based on category name
// Maps common Brazilian financial category keywords to lucide icon names

const ICON_MAPPING: { keywords: string[]; icon: string }[] = [
  { keywords: ["salário", "salario", "remuneração", "remuneracao", "pró-labore", "pro-labore"], icon: "wallet" },
  { keywords: ["aluguel", "aluguer", "rent", "locação", "locacao"], icon: "home" },
  { keywords: ["alimentação", "alimentacao", "refeição", "refeicao", "restaurante", "comida", "mercado", "supermercado"], icon: "utensils" },
  { keywords: ["transporte", "combustível", "combustivel", "gasolina", "uber", "taxi", "ônibus", "onibus", "estacionamento"], icon: "car" },
  { keywords: ["saúde", "saude", "médico", "medico", "farmácia", "farmacia", "hospital", "plano de saúde", "plano de saude", "odonto", "dentista"], icon: "heart" },
  { keywords: ["educação", "educacao", "escola", "curso", "faculdade", "universidade", "treinamento", "livro"], icon: "book-open" },
  { keywords: ["energia", "elétrica", "eletrica", "luz", "eletricidade"], icon: "zap" },
  { keywords: ["água", "agua", "saneamento", "esgoto"], icon: "droplets" },
  { keywords: ["internet", "telefone", "celular", "telecom", "telecomunicação", "telecomunicacao", "fibra"], icon: "wifi" },
  { keywords: ["seguro", "seguros", "proteção", "protecao"], icon: "shield" },
  { keywords: ["imposto", "impostos", "tributo", "taxa", "icms", "iss", "pis", "cofins", "irpj", "csll", "inss", "fgts"], icon: "file-text" },
  { keywords: ["venda", "vendas", "receita operacional", "faturamento", "serviço", "servico"], icon: "trending-up" },
  { keywords: ["marketing", "propaganda", "publicidade", "anúncio", "anuncio", "ads"], icon: "megaphone" },
  { keywords: ["viagem", "hospedagem", "passagem", "aéreo", "aereo", "hotel"], icon: "plane" },
  { keywords: ["lazer", "entretenimento", "diversão", "diversao", "festa", "cinema"], icon: "gamepad-2" },
  { keywords: ["material", "escritório", "escritorio", "suprimento", "papelaria"], icon: "briefcase" },
  { keywords: ["manutenção", "manutencao", "reparo", "conserto"], icon: "wrench" },
  { keywords: ["investimento", "aplicação", "aplicacao", "rendimento", "juros", "dividendo"], icon: "trending-up" },
  { keywords: ["empréstimo", "emprestimo", "financiamento", "parcela", "prestação", "prestacao"], icon: "banknote" },
  { keywords: ["contabilidade", "contador", "auditoria", "consultoria", "assessoria"], icon: "calculator" },
  { keywords: ["folha", "pessoal", "funcionário", "funcionario", "benefício", "beneficio", "vale"], icon: "users" },
  { keywords: ["presente", "doação", "doacao", "caridade"], icon: "gift" },
  { keywords: ["assinatura", "software", "sistema", "licença", "licenca", "saas"], icon: "monitor" },
  { keywords: ["limpeza", "higiene", "conservação", "conservacao"], icon: "sparkles" },
  { keywords: ["frete", "logística", "logistica", "entrega", "envio", "correio"], icon: "truck" },
  { keywords: ["banco", "tarifa bancária", "tarifa bancaria", "iof", "ted", "pix", "doc", "tarifa"], icon: "building-2" },
  { keywords: ["cliente", "receita recorrente", "mensalidade", "anuidade"], icon: "repeat" },
  { keywords: ["comissão", "comissao", "bônus", "bonus", "premiação", "premiacao"], icon: "award" },
  { keywords: ["resgate"], icon: "arrow-down-to-line" },
];

export function getAutoIcon(categoryName: string): string {
  const nameLower = categoryName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (const mapping of ICON_MAPPING) {
    for (const keyword of mapping.keywords) {
      const keywordNormalized = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (nameLower.includes(keywordNormalized)) {
        return mapping.icon;
      }
    }
  }
  
  return "tag"; // Default icon
}

// Available lucide icon names that we use
export const CATEGORY_ICON_NAMES = [
  "tag", "wallet", "home", "utensils", "car", "heart", "book-open", "zap",
  "droplets", "wifi", "shield", "file-text", "trending-up", "megaphone",
  "plane", "gamepad-2", "briefcase", "wrench", "banknote", "calculator",
  "users", "gift", "monitor", "sparkles", "truck", "building-2", "repeat",
  "award", "arrow-down-to-line",
] as const;
