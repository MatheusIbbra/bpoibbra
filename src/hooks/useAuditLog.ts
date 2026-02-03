import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useOrganizations";

export interface AuditLogEntry {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_name?: string | null;
  org_name?: string | null;
}

export function useAuditLog(limit: number = 50) {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ["audit-log", organization?.id, limit],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (organization?.id) {
        query = query.eq("organization_id", organization.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch user names separately
      const userIds = [...new Set(data?.map(d => d.user_id).filter(Boolean) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      return (data || []).map(entry => ({
        ...entry,
        user_name: profileMap.get(entry.user_id || "") || null,
        old_values: entry.old_values as Record<string, unknown> | null,
        new_values: entry.new_values as Record<string, unknown> | null,
      })) as AuditLogEntry[];
    },
    enabled: !!organization?.id,
  });
}

export function useAllAuditLogs(limit: number = 100) {
  return useQuery({
    queryKey: ["all-audit-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set(data?.map(d => d.user_id).filter(Boolean) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      // Fetch org names
      const orgIds = [...new Set(data?.map(d => d.organization_id).filter(Boolean) || [])];
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      const orgMap = new Map(orgs?.map(o => [o.id, o.name]) || []);

      return (data || []).map(entry => ({
        ...entry,
        user_name: profileMap.get(entry.user_id || "") || null,
        org_name: orgMap.get(entry.organization_id || "") || null,
        old_values: entry.old_values as Record<string, unknown> | null,
        new_values: entry.new_values as Record<string, unknown> | null,
      })) as AuditLogEntry[];
    },
  });
}

// Helper to create audit log entries from the frontend
export async function createAuditLogEntry(
  action: string,
  tableName: string,
  recordId?: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
  organizationId?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase.from("audit_log").insert([{
    user_id: user?.id || null,
    organization_id: organizationId || null,
    action,
    table_name: tableName,
    record_id: recordId || null,
    old_values: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
    new_values: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
  }]);

  if (error) {
    console.error("Failed to create audit log:", error);
  }
}
