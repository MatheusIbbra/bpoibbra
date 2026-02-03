import { useState } from "react";
import { MessageCircle, X, Send, Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIAssistantChatProps {
  isPaidUser?: boolean;
}

export function AIAssistantChat({ isPaidUser = false }: AIAssistantChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Olá! Sou seu assistente financeiro. Como posso ajudar você hoje?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || !isPaidUser) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response (in production, this would call an AI API)
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getSimulatedResponse(input),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const getSimulatedResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes("saldo") || lowerQuestion.includes("quanto")) {
      return "Para verificar seu saldo atual, vá até a página de Contas. Lá você encontrará o saldo consolidado de todas as suas contas bancárias, calculado automaticamente com base nas transações registradas.";
    }
    
    if (lowerQuestion.includes("despesa") || lowerQuestion.includes("gasto")) {
      return "Na seção de Relatórios, você pode visualizar um gráfico detalhado de despesas por categoria. Isso ajudará a identificar onde está gastando mais e encontrar oportunidades de economia.";
    }
    
    if (lowerQuestion.includes("orçamento") || lowerQuestion.includes("orcamento")) {
      return "O orçamento permite definir limites de gastos por categoria. Na página de Orçamentos, você pode criar metas mensais e acompanhar o progresso. Quando ultrapassar 80% do limite, você será alertado.";
    }
    
    if (lowerQuestion.includes("meta") || lowerQuestion.includes("objetivo")) {
      return "As metas financeiras ajudam a planejar objetivos como viagens, reservas de emergência ou compras grandes. Vá até Metas para criar e acompanhar seu progresso.";
    }
    
    return "Posso ajudar você a entender seus relatórios financeiros, explicar indicadores como fluxo de caixa, margem de lucro, e dar sugestões para melhorar sua saúde financeira. O que gostaria de saber?";
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-[calc(100%-2rem)] max-w-sm md:max-w-md h-[500px] md:h-[600px] shadow-xl z-50 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Assistente IA</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {!isPaidUser ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Recurso Premium</h3>
            <p className="text-muted-foreground text-sm mb-4">
              O assistente de IA está disponível apenas para assinantes do plano pago.
            </p>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              R$ 99,00/mês
            </Badge>
            <p className="text-xs text-muted-foreground mt-4">
              Tire dúvidas financeiras, entenda seus relatórios e receba sugestões personalizadas.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua pergunta..."
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
