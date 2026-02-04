export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          bank_name: string | null
          color: string | null
          created_at: string
          current_balance: number | null
          id: string
          initial_balance: number | null
          name: string
          organization_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["account_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          bank_name?: string | null
          color?: string | null
          created_at?: string
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          name: string
          organization_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          bank_name?: string | null
          color?: string | null
          created_at?: string
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          name?: string
          organization_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_strategic_insights: {
        Row: {
          created_at: string
          id: string
          insights_json: Json
          metrics_json: Json | null
          model: string | null
          organization_id: string
          period: string
          token_usage: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          insights_json: Json
          metrics_json?: Json | null
          model?: string | null
          organization_id: string
          period: string
          token_usage?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          insights_json?: Json
          metrics_json?: Json | null
          model?: string | null
          organization_id?: string
          period?: string
          token_usage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_strategic_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_suggestions: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          confidence_score: number | null
          created_at: string
          id: string
          model_version: string | null
          reasoning: string | null
          suggested_category_id: string | null
          suggested_competence_date: string | null
          suggested_cost_center_id: string | null
          suggested_type: string | null
          transaction_id: string
          was_accepted: boolean | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          model_version?: string | null
          reasoning?: string | null
          suggested_category_id?: string | null
          suggested_competence_date?: string | null
          suggested_cost_center_id?: string | null
          suggested_type?: string | null
          transaction_id: string
          was_accepted?: boolean | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          model_version?: string | null
          reasoning?: string | null
          suggested_category_id?: string | null
          suggested_competence_date?: string | null
          suggested_cost_center_id?: string | null
          suggested_type?: string | null
          transaction_id?: string
          was_accepted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_suggested_cost_center_id_fkey"
            columns: ["suggested_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          cost_center_id: string | null
          created_at: string
          id: string
          month: number
          organization_id: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          amount: number
          category_id: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          month: number
          organization_id?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          category_id?: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          month?: number
          organization_id?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          dre_group: string | null
          icon: string | null
          id: string
          name: string
          organization_id: string | null
          parent_id: string | null
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          dre_group?: string | null
          icon?: string | null
          id?: string
          name: string
          organization_id?: string | null
          parent_id?: string | null
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          dre_group?: string | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      file_imports: {
        Row: {
          account_id: string
          created_at: string
          failed_rows: number | null
          file_name: string
          id: string
          imported_rows: number | null
          status: string | null
          total_rows: number | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          failed_rows?: number | null
          file_name: string
          id?: string
          imported_rows?: number | null
          status?: string | null
          total_rows?: number | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          failed_rows?: number | null
          file_name?: string
          id?: string
          imported_rows?: number | null
          status?: string | null
          total_rows?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          account_id: string
          created_at: string
          duplicate_count: number | null
          error_count: number | null
          error_message: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          imported_count: number | null
          metadata: Json | null
          organization_id: string
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["import_status"]
          total_transactions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          duplicate_count?: number | null
          error_count?: number | null
          error_message?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          imported_count?: number | null
          metadata?: Json | null
          organization_id: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_transactions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          duplicate_count?: number | null
          error_count?: number | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          imported_count?: number | null
          metadata?: Json | null
          organization_id?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_transactions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          blocked_at: string | null
          blocked_reason: string | null
          cpf_cnpj: string | null
          created_at: string
          id: string
          is_blocked: boolean | null
          kam_id: string | null
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          is_blocked?: boolean | null
          kam_id?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          is_blocked?: boolean | null
          kam_id?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          full_name: string | null
          id: string
          is_blocked: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reconciliation_rules: {
        Row: {
          amount: number
          category_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string
          due_day: number | null
          id: string
          is_active: boolean | null
          organization_id: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description: string
          due_day?: number | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          transaction_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string
          due_day?: number | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_rules_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_patterns: {
        Row: {
          avg_amount: number | null
          category_id: string | null
          confidence: number | null
          cost_center_id: string | null
          created_at: string
          id: string
          last_used_at: string | null
          normalized_description: string
          occurrences: number | null
          organization_id: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          avg_amount?: number | null
          category_id?: string | null
          confidence?: number | null
          cost_center_id?: string | null
          created_at?: string
          id?: string
          last_used_at?: string | null
          normalized_description: string
          occurrences?: number | null
          organization_id: string
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          avg_amount?: number | null
          category_id?: string | null
          confidence?: number | null
          cost_center_id?: string | null
          created_at?: string
          id?: string
          last_used_at?: string | null
          normalized_description?: string
          occurrences?: number | null
          organization_id?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_patterns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_patterns_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_patterns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          accrual_date: string | null
          amount: number
          category_id: string | null
          classification_source: string | null
          cost_center_id: string | null
          created_at: string
          date: string
          description: string | null
          due_date: string | null
          id: string
          import_batch_id: string | null
          is_ignored: boolean | null
          linked_transaction_id: string | null
          normalized_description: string | null
          notes: string | null
          organization_id: string | null
          paid_amount: number | null
          payment_date: string | null
          payment_method: string | null
          raw_description: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          transaction_hash: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
          validation_status:
            | Database["public"]["Enums"]["validation_status"]
            | null
        }
        Insert: {
          account_id: string
          accrual_date?: string | null
          amount: number
          category_id?: string | null
          classification_source?: string | null
          cost_center_id?: string | null
          created_at?: string
          date: string
          description?: string | null
          due_date?: string | null
          id?: string
          import_batch_id?: string | null
          is_ignored?: boolean | null
          linked_transaction_id?: string | null
          normalized_description?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          raw_description?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          transaction_hash?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
        }
        Update: {
          account_id?: string
          accrual_date?: string | null
          amount?: number
          category_id?: string | null
          classification_source?: string | null
          cost_center_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          due_date?: string | null
          id?: string
          import_batch_id?: string | null
          is_ignored?: boolean | null
          linked_transaction_id?: string | null
          normalized_description?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          raw_description?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          transaction_hash?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          destination_account_id: string
          id: string
          organization_id: string | null
          origin_account_id: string
          status: Database["public"]["Enums"]["transaction_status"] | null
          transfer_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          destination_account_id: string
          id?: string
          organization_id?: string | null
          origin_account_id: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          transfer_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          destination_account_id?: string
          id?: string
          organization_id?: string | null
          origin_account_id?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          transfer_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_origin_account_id_fkey"
            columns: ["origin_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_hierarchy: {
        Row: {
          created_at: string
          id: string
          supervisor_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          supervisor_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          supervisor_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_account_balance: {
        Args: { account_uuid: string }
        Returns: number
      }
      can_manage_org_members: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_organization: {
        Args: { _org_id: string; _viewer_id: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { _profile_user_id: string; _viewer_id: string }
        Returns: boolean
      }
      can_view_transaction: {
        Args: { _transaction_org_id: string; _viewer_id: string }
        Returns: boolean
      }
      can_view_user_data: {
        Args: { _target_user_id: string; _viewer_id: string }
        Returns: boolean
      }
      generate_financial_metrics: {
        Args: { p_organization_id: string; p_period?: string }
        Returns: Json
      }
      get_subordinates: { Args: { _user_id: string }; Returns: string[] }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_organizations: { Args: { _user_id: string }; Returns: string[] }
      get_viewable_organizations: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_transaction_description: {
        Args: { description: string }
        Returns: string
      }
      text_similarity: {
        Args: { text1: string; text2: string }
        Returns: number
      }
      upsert_transaction_pattern: {
        Args: {
          p_amount: number
          p_category_id: string
          p_cost_center_id: string
          p_normalized_description: string
          p_organization_id: string
          p_transaction_type: string
        }
        Returns: string
      }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      validate_hierarchy_chain: {
        Args: { _role: string; _user_id: string }
        Returns: Json
      }
    }
    Enums: {
      account_status: "active" | "inactive"
      account_type:
        | "checking"
        | "savings"
        | "investment"
        | "credit_card"
        | "cash"
      app_role:
        | "admin"
        | "user"
        | "supervisor"
        | "fa"
        | "kam"
        | "cliente"
        | "projetista"
      category_type: "income" | "expense" | "investment" | "redemption"
      import_status:
        | "pending"
        | "processing"
        | "awaiting_validation"
        | "completed"
        | "failed"
        | "cancelled"
      transaction_status: "pending" | "completed" | "cancelled"
      transaction_type:
        | "income"
        | "expense"
        | "transfer"
        | "investment"
        | "redemption"
      validation_status:
        | "pending_validation"
        | "validated"
        | "rejected"
        | "needs_review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "inactive"],
      account_type: [
        "checking",
        "savings",
        "investment",
        "credit_card",
        "cash",
      ],
      app_role: [
        "admin",
        "user",
        "supervisor",
        "fa",
        "kam",
        "cliente",
        "projetista",
      ],
      category_type: ["income", "expense", "investment", "redemption"],
      import_status: [
        "pending",
        "processing",
        "awaiting_validation",
        "completed",
        "failed",
        "cancelled",
      ],
      transaction_status: ["pending", "completed", "cancelled"],
      transaction_type: [
        "income",
        "expense",
        "transfer",
        "investment",
        "redemption",
      ],
      validation_status: [
        "pending_validation",
        "validated",
        "rejected",
        "needs_review",
      ],
    },
  },
} as const
