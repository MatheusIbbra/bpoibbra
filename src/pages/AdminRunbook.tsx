import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldAlert, Database, Wifi, Brain, Lock } from "lucide-react";

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "1": <Database className="h-5 w-5 text-destructive" />,
  "2": <Wifi className="h-5 w-5 text-warning" />,
  "3": <Brain className="h-5 w-5 text-primary" />,
  "4": <Lock className="h-5 w-5 text-destructive" />,
};

const AdminRunbook = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isLoading: rolesLoading } = useIsAdmin();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (!authLoading && !rolesLoading && !isAdmin) navigate("/");
  }, [user, authLoading, rolesLoading, isAdmin, navigate]);

  useEffect(() => {
    fetch("/docs/RUNBOOK-DR.md")
      .then(r => r.text())
      .then(text => { setContent(text); setLoadingDoc(false); })
      .catch(() => setLoadingDoc(false));
  }, []);

  if (authLoading || rolesLoading || loadingDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  // Parse sections from markdown
  const sections = content.split(/^## /m).filter(Boolean).map(section => {
    const lines = section.split("\n");
    const title = lines[0].replace(/^#+\s*/, "").trim();
    const body = lines.slice(1).join("\n").trim();
    const num = title.match(/^(\d+)/)?.[1] || "";
    return { title, body, num };
  });

  // Simple markdown renderer
  const renderMarkdown = (md: string) => {
    return md.split("\n").map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground">{line.replace("### ", "")}</h3>;
      if (line.startsWith("- [ ] ")) return <label key={i} className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="rounded" />{line.replace("- [ ] ", "")}</label>;
      if (line.startsWith("- ")) return <li key={i} className="text-sm text-muted-foreground ml-4 list-disc">{line.replace("- ", "")}</li>;
      if (line.startsWith("```")) return null;
      if (line.startsWith("|")) return <pre key={i} className="text-xs text-muted-foreground font-mono">{line}</pre>;
      if (line.trim() === "---") return <hr key={i} className="my-4 border-border" />;
      if (line.trim() === "") return <br key={i} />;
      return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>;
    });
  };

  return (
    <AppLayout title="Runbook — Disaster Recovery">
      <div className="max-w-4xl mx-auto space-y-4 p-4">
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert className="h-7 w-7 text-destructive" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Runbook de Disaster Recovery</h1>
            <p className="text-sm text-muted-foreground">Procedimentos de recuperação para cenários críticos</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {sections.filter(s => s.num).map(s => (
            <a
              key={s.num}
              href={`#section-${s.num}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              {SECTION_ICONS[s.num]}
              {s.title.replace(/^\d+\.\s*/, "")}
            </a>
          ))}
        </div>

        {sections.map((section, idx) => (
          <Card key={idx} id={section.num ? `section-${section.num}` : undefined}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                {section.num && SECTION_ICONS[section.num]}
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              </div>
              <div className="space-y-1">{renderMarkdown(section.body)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};

export default AdminRunbook;
