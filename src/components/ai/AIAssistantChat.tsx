import { useState, useRef, useEffect } from "react";
import { Plus, X, Send, Loader2, Lock, Sparkles, ArrowUpRight, ArrowDownLeft, Wallet, Building2, PenLine, ChevronRight, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { AccountDialog } from "@/components/accounts/AccountDialog";
import { useOpenPluggyConnect, useSavePluggyItem, useSyncBankConnection } from "@/hooks/useBankConnections";
import { useAutoIgnoreTransfers } from "@/hooks/useAutoIgnoreTransfers";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIAssistantChatProps {
  isPaidUser?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

async function streamChat({
  messages,
  organizationId,
  onDelta,
  onDone,
  onError,
}: {
  messages: Array<{ role: string; content: string }>;
  organizationId?: string | null;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  // Use authenticated session token instead of publishable key
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    onError("Sessão expirada. Faça login novamente.");
    return;
  }

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages, organization_id: organizationId }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 429) {
      onError("Limite de requisições excedido. Tente novamente em alguns minutos.");
      return;
    }
    if (resp.status === 402) {
      onError("Créditos de IA esgotados.");
      return;
    }
    onError(data.error || "Erro ao conectar com a IA");
    return;
  }

  if (!resp.body) {
    onError("Stream não disponível");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export function AIAssistantChat({ isPaidUser = false }: AIAssistantChatProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txDialogType, setTxDialogType] = useState<"income" | "expense">("expense");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountSubMenuOpen, setAccountSubMenuOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pendingOrgIdRef = useRef<string | null>(null);
  const handledRef = useRef(false);
  const openPluggyConnect = useOpenPluggyConnect();
  const savePluggyItem = useSavePluggyItem();
  const syncConnection = useSyncBankConnection();
  const autoIgnoreTransfers = useAutoIgnoreTransfers();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Olá! Sou seu Wealth Advisor IBBRA. Como posso ajudar na gestão do seu patrimônio hoje?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { selectedOrganizationId, getRequiredOrganizationId } = useBaseFilter();
  const { openUpgradeModal } = useUpgradeModal();
  const navigate = useNavigate();

  // Pluggy popup message handler
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const { type, data, error } = event.data || {};
      if (type === 'pluggy-success' && data) {
        if (handledRef.current) return;
        handledRef.current = true;
        const orgId = pendingOrgIdRef.current;
        const itemId = data?.item?.id || data?.id || data?.itemId || (typeof data === 'string' ? data : null);
        const connectorName = data?.item?.connector?.name || data?.connector?.name || data?.connectorName;
        if (!itemId || !orgId) {
          toast.error("Não foi possível identificar a conexão. Tente novamente.");
          setIsConnecting(false); handledRef.current = false; return;
        }
        try {
          toast.info("Salvando conexão bancária...");
          await savePluggyItem.mutateAsync({ organizationId: orgId, itemId, connectorName });
          toast.info("Sincronizando transações... Aguarde até 60 segundos.");
          const result = await syncConnection.mutateAsync({ organizationId: orgId, itemId });
          if (result.imported > 0) {
            toast.success(`Sincronização concluída: ${result.imported} transações importadas`);
          } else {
            toast.info(`Contas sincronizadas (${result.accounts || 0}).`);
          }
          try { await autoIgnoreTransfers.mutateAsync(orgId); } catch { /* ignore */ }
        } catch (err: any) {
          toast.error("Erro ao salvar conexão: " + (err?.message || 'Erro'));
        }
        setIsConnecting(false); pendingOrgIdRef.current = null; handledRef.current = false;
      } else if (type === 'pluggy-error') {
        toast.error("Erro na conexão bancária");
        setIsConnecting(false); pendingOrgIdRef.current = null; handledRef.current = false;
      } else if (type === 'pluggy-close') {
        setTimeout(() => { setIsConnecting(false); pendingOrgIdRef.current = null; handledRef.current = false; }, 2000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [savePluggyItem, syncConnection, autoIgnoreTransfers]);

  const handleOpenFinanceConnect = async () => {
    const organizationId = getRequiredOrganizationId();
    if (!organizationId) return;
    setIsConnecting(true);
    pendingOrgIdRef.current = organizationId;
    setIsMenuOpen(false); setAccountSubMenuOpen(false);
    try {
      const result = await openPluggyConnect.mutateAsync({ organizationId });
      if (!result.accessToken) { toast.error("Token inválido."); setIsConnecting(false); return; }
      const popup = window.open(`/pluggy-connect.html#${result.accessToken}`, 'pluggy-connect', 'width=500,height=700,scrollbars=yes,resizable=yes,left=200,top=100');
      if (!popup) { toast.error("Popup bloqueado. Permita popups para este site."); setIsConnecting(false); return; }
      popupRef.current = popup;
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setTimeout(() => { if (!handledRef.current) { setIsConnecting(false); pendingOrgIdRef.current = null; } }, 3000);
        }
      }, 500);
    } catch (error: any) {
      toast.error("Falha ao conectar: " + (error?.message || 'Erro'));
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !isPaidUser || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    const apiMessages = [...messages, userMessage]
      .filter((m) => m.id !== "1")
      .map((m) => ({ role: m.role, content: m.content }));

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id.startsWith("stream-")) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [
          ...prev,
          {
            id: `stream-${Date.now()}`,
            role: "assistant" as const,
            content: assistantSoFar,
            timestamp: new Date(),
          },
        ];
      });
    };

    try {
      await streamChat({
        messages: apiMessages,
        organizationId: selectedOrganizationId,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (error) => {
          toast.error(error);
          setIsLoading(false);
        },
      });
    } catch {
      toast.error("Erro ao conectar com o assistente");
      setIsLoading(false);
    }
  };

  const quickActions = [
    {
      label: "Nova Receita",
      icon: ArrowUpRight,
      className: "text-success",
      action: () => { setTxDialogType("income"); setTxDialogOpen(true); setIsMenuOpen(false); setAccountSubMenuOpen(false); },
    },
    {
      label: "Nova Despesa",
      icon: ArrowDownLeft,
      className: "text-destructive",
      action: () => { setTxDialogType("expense"); setTxDialogOpen(true); setIsMenuOpen(false); setAccountSubMenuOpen(false); },
    },
    {
      label: "Nova Conta",
      icon: Building2,
      className: "text-foreground",
      action: () => { setAccountSubMenuOpen((v) => !v); },
      hasSubMenu: true,
    },
    {
      label: "Novo Orçamento",
      icon: Wallet,
      className: "text-primary",
      action: () => { navigate("/orcamentos"); setIsMenuOpen(false); setAccountSubMenuOpen(false); },
    },
    {
      label: "Inteligência Artificial Financeira",
      icon: Sparkles,
      className: "text-primary",
      action: () => { openUpgradeModal("ai"); setIsMenuOpen(false); setAccountSubMenuOpen(false); },
    },
  ];

  // FAB with menu
  if (!isChatOpen) {
    return (
      <>
        {/* Quick actions menu */}
        {isMenuOpen && (
          <div className="fixed bottom-20 right-4 md:bottom-[5.5rem] md:right-6 z-50 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {quickActions.map((action) => (
              <div key={action.label}>
                <button
                  onClick={action.action}
                  className="flex items-center gap-3 bg-card border border-border shadow-lg rounded-xl px-4 py-3 hover:bg-muted/60 transition-colors text-left w-full"
                >
                  <action.icon className={cn("h-4 w-4 shrink-0", action.className)} />
                  <span className="text-sm font-medium whitespace-nowrap flex-1">{action.label}</span>
                  {(action as any).hasSubMenu && (
                    <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", accountSubMenuOpen && "rotate-90")} />
                  )}
                </button>
                {/* Sub-menu for Nova Conta */}
                {(action as any).hasSubMenu && accountSubMenuOpen && (
                  <div className="mt-1 ml-4 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      onClick={handleOpenFinanceConnect}
                      disabled={isConnecting}
                      className="flex items-center gap-3 bg-card/90 border border-border/70 shadow-md rounded-xl px-4 py-2.5 hover:bg-muted/60 transition-colors text-left disabled:opacity-60"
                    >
                      {isConnecting ? <Loader2 className="h-3.5 w-3.5 shrink-0 text-primary animate-spin" /> : <Unplug className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-foreground">Conectar via Open Finance</span>
                        <span className="text-[10px] text-muted-foreground">Sincronização automática</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setAccountDialogOpen(true); setIsMenuOpen(false); setAccountSubMenuOpen(false); }}
                      className="flex items-center gap-3 bg-card/90 border border-border/70 shadow-md rounded-xl px-4 py-2.5 hover:bg-muted/60 transition-colors text-left"
                    >
                      <PenLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-foreground">Criar conta manualmente</span>
                        <span className="text-[10px] text-muted-foreground">Lançamentos manuais</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Overlay */}
        {isMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        {/* FAB */}
        <Button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={cn(
            "fixed bottom-4 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg z-50 transition-transform",
            isMenuOpen && "rotate-45"
          )}
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>

        {/* Transaction Dialog */}
        <TransactionDialog
          open={txDialogOpen}
          onOpenChange={setTxDialogOpen}
          defaultType={txDialogType}
        />

        {/* Account Dialog */}
        <AccountDialog
          open={accountDialogOpen}
          onOpenChange={setAccountDialogOpen}
        />
      </>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-[calc(100%-2rem)] max-w-sm md:max-w-md h-[500px] md:h-[600px] shadow-xl z-50 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Wealth Advisor IA</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)}>
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
              O Wealth Advisor está disponível para assinantes do plano pago.
            </p>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              R$ 99,00/mês
            </Badge>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
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
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
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
                  placeholder="Pergunte sobre seu patrimônio..."
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
