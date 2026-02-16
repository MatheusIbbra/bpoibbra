import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function TermosDeUso() {
  const navigate = useNavigate();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("legal_documents")
      .select("content, version")
      .eq("document_type", "terms")
      .eq("active", true)
      .maybeSingle()
      .then(({ data }) => {
        setContent(data?.content || null);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {content.split("\n").map((line, i) => {
              if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mt-8 mb-4">{line.slice(2)}</h1>;
              if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
              if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-muted-foreground">{line.slice(2, -2)}</p>;
              if (line.startsWith("- ")) return <li key={i} className="ml-4 text-sm text-muted-foreground">{line.slice(2)}</li>;
              if (line.trim() === "") return <br key={i} />;
              return <p key={i} className="text-sm text-foreground/80 leading-relaxed">{line}</p>;
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Documento não encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
