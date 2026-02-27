import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { Transaction, TransactionType, TransactionStatus } from "./useTransactions";

const PAGE_SIZE = 50;

interface PaginatedFilters {
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  accountId?: string;
  costCenterId?: string;
  status?: TransactionStatus;
  search?: string;
  page?: number;
  classificationFilter?: "all" | "classified" | "unclassified";
}

interface PaginatedResult {
  data: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function usePaginatedTransactions(filters?: PaginatedFilters) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const page = filters?.page || 0;

  return useQuery({
    queryKey: ["paginated-transactions", user?.id, orgFilter.type, orgFilter.ids, filters],
    queryFn: async (): Promise<PaginatedResult> => {
      // Count query
      let countQuery = supabase
        .from("transactions")
        .select("id", { count: "exact", head: true });

      // Data query  
      let dataQuery = supabase
        .from("transactions")
        .select(`
          *,
          categories (id, name, icon, color),
          accounts (id, name, bank_name),
          cost_centers (id, name)
        `)
        .order("date", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // Apply org filter to both
      if (orgFilter.type === 'single') {
        countQuery = countQuery.eq("organization_id", orgFilter.ids[0]);
        dataQuery = dataQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        countQuery = countQuery.in("organization_id", orgFilter.ids);
        dataQuery = dataQuery.in("organization_id", orgFilter.ids);
      }

      // Apply filters to both
      const applyFilters = (q: any) => {
        if (filters?.type) q = q.eq("type", filters.type);
        if (filters?.startDate) q = q.gte("date", filters.startDate);
        if (filters?.endDate) q = q.lte("date", filters.endDate);
        if (filters?.categoryId) q = q.eq("category_id", filters.categoryId);
        if (filters?.accountId) q = q.eq("account_id", filters.accountId);
        if (filters?.costCenterId) q = q.eq("cost_center_id", filters.costCenterId);
        if (filters?.status) q = q.eq("status", filters.status);
        if (filters?.search) q = q.ilike("description", `%${filters.search}%`);
        if (filters?.classificationFilter === "classified") q = q.not("category_id", "is", null);
        if (filters?.classificationFilter === "unclassified") q = q.is("category_id", null);
        return q;
      };

      countQuery = applyFilters(countQuery);
      dataQuery = applyFilters(dataQuery);

      const [{ count, error: countError }, { data, error }] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      if (countError) throw countError;
      if (error) throw error;

      const totalCount = count || 0;

      return {
        data: (data || []).map(t => ({ ...t, amount: Number(t.amount) })) as Transaction[],
        totalCount,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(totalCount / PAGE_SIZE),
      };
    },
    enabled: !!user,
    placeholderData: (prev) => prev,
  });
}
