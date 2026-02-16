import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactionComments, useCreateComment, useDeleteComment } from "@/hooks/useTransactionComments";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleView } from "@/hooks/useRoleView";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Send, Trash2 } from "lucide-react";

interface TransactionCommentsProps {
  transactionId: string;
}

export function TransactionComments({ transactionId }: TransactionCommentsProps) {
  const { showInternalComments } = useRoleView();
  const { user } = useAuth();
  const { data: comments, isLoading } = useTransactionComments(transactionId);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState("");

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createComment.mutate(
      { transactionId, comment: newComment.trim() },
      { onSuccess: () => setNewComment("") }
    );
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  // Clients don't see internal comments section
  if (!showInternalComments) return null;

  return (
    <div className="space-y-3 mt-4 border-t pt-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        <span>Comentários internos ({comments?.length || 0})</span>
      </div>

      {/* Comments list */}
      {comments && comments.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 group">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">
                  {getInitials(comment.profiles?.full_name ?? null)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    {comment.profiles?.full_name || "Usuário"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-foreground mt-0.5">{comment.comment}</p>
              </div>
              {user?.id === comment.user_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteComment.mutate({ id: comment.id, transactionId })}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New comment input */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Adicionar comentário..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[36px] h-9 text-xs resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!newComment.trim() || createComment.isPending}
          className="h-9 px-3"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
