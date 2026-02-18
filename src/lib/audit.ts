import { supabase } from "@/integrations/supabase/client";

/**
 * IBBRA — Audit Log Helper
 * Convenience wrapper around audit_log table inserts.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function logAudit(
  action: string,
  tableName: string,
  recordId?: string,
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null,
  organizationId?: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("audit_log").insert([{
      user_id: user?.id || null,
      organization_id: organizationId || null,
      action,
      table_name: tableName,
      record_id: recordId || null,
      old_values: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
      new_values: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
    }]);
  } catch (err) {
    console.error("[Audit] Failed to log:", err);
  }
}
