import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface TransactionComment {
  id: string;
  transaction_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function useTransactionComments(transactionId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transaction-comments", transactionId],
    queryFn: async () => {
      if (!transactionId) return [];

      const { data, error } = await supabase
        .from("transaction_comments")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Fetch profiles for comment authors
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds)
        : { data: [] };
      
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      
      return (data || []).map(c => ({
        ...c,
        profiles: profileMap.get(c.user_id) || null,
      })) as TransactionComment[];
    },
    enabled: !!user && !!transactionId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ transactionId, comment }: { transactionId: string; comment: string }) => {
      const { data, error } = await supabase
        .from("transaction_comments")
        .insert({
          transaction_id: transactionId,
          user_id: user!.id,
          comment,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transaction-comments", variables.transactionId] });
      toast.success("Comentário adicionado!");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar comentário: " + error.message);
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, transactionId }: { id: string; transactionId: string }) => {
      const { error } = await supabase
        .from("transaction_comments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return transactionId;
    },
    onSuccess: (transactionId) => {
      queryClient.invalidateQueries({ queryKey: ["transaction-comments", transactionId] });
      toast.success("Comentário removido!");
    },
    onError: (error) => {
      toast.error("Erro ao remover comentário: " + error.message);
    },
  });
}
