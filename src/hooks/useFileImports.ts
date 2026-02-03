import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type FileImportRow = Database["public"]["Tables"]["file_imports"]["Row"];
type FileImportInsert = Database["public"]["Tables"]["file_imports"]["Insert"];

export interface FileImport extends FileImportRow {}

export function useFileImports() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["file_imports", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("file_imports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as FileImport[];
    },
    enabled: !!user,
  });
}

export function useCreateFileImport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (fileImport: {
      file_name: string;
      account_id: string;
      total_rows?: number;
      imported_rows?: number;
      failed_rows?: number;
      status?: string;
    }) => {
      const insertData: FileImportInsert = {
        ...fileImport,
        user_id: user!.id,
      };
      
      const { data, error } = await supabase
        .from("file_imports")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["file_imports"] });
    },
    onError: (error) => {
      toast.error("Erro ao registrar importação: " + error.message);
    },
  });
}

export function useUpdateFileImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fileImport }: { id: string } & Partial<{
      total_rows: number;
      imported_rows: number;
      failed_rows: number;
      status: string;
    }>) => {
      const { data, error } = await supabase
        .from("file_imports")
        .update(fileImport)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["file_imports"] });
    },
  });
}

export function useDeleteFileImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("file_imports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["file_imports"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Importação e transações relacionadas excluídas!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir importação: " + error.message);
    },
  });
}
