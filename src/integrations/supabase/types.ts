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
      account_balance_snapshots: {
        Row: {
          account_id: string
          balance: number
          id: string
          last_transaction_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          balance?: number
          id?: string
          last_transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          balance?: number
          id?: string
          last_transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balance_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_balance_snapshots_last_transaction_id_fkey"
            columns: ["last_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          bank_name: string | null
          color: string | null
          created_at: string
          currency_code: string
          current_balance: number | null
          id: string
          initial_balance: number | null
          last_official_balance_at: string | null
          name: string
          official_balance: number | null
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
          currency_code?: string
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          last_official_balance_at?: string | null
          name: string
          official_balance?: number | null
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
          currency_code?: string
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          last_official_balance_at?: string | null
          name?: string
          official_balance?: number | null
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
      api_usage_logs: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          organization_id: string | null
          request_metadata: Json | null
          tokens_used: number | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          organization_id?: string | null
          request_metadata?: Json | null
          tokens_used?: number | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          organization_id?: string | null
          request_metadata?: Json | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      bank_connections: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          encryption_version: number | null
          external_account_id: string | null
          external_consent_id: string | null
          id: string
          last_sync_at: string | null
          metadata: Json | null
          organization_id: string
          provider: string
          provider_name: string | null
          refresh_token_encrypted: string | null
          status: string
          sync_error: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          encryption_version?: number | null
          external_account_id?: string | null
          external_consent_id?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          organization_id: string
          provider?: string
          provider_name?: string | null
          refresh_token_encrypted?: string | null
          status?: string
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          encryption_version?: number | null
          external_account_id?: string | null
          external_consent_id?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          organization_id?: string
          provider?: string
          provider_name?: string | null
          refresh_token_encrypted?: string | null
          status?: string
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_organization_id_fkey"
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
      cashflow_forecasts: {
        Row: {
          based_on_patterns: boolean | null
          confidence_score: number | null
          created_at: string
          forecast_date: string
          id: string
          organization_id: string
          projected_balance: number
          projected_expense: number | null
          projected_income: number | null
        }
        Insert: {
          based_on_patterns?: boolean | null
          confidence_score?: number | null
          created_at?: string
          forecast_date: string
          id?: string
          organization_id: string
          projected_balance?: number
          projected_expense?: number | null
          projected_income?: number | null
        }
        Update: {
          based_on_patterns?: boolean | null
          confidence_score?: number | null
          created_at?: string
          forecast_date?: string
          id?: string
          organization_id?: string
          projected_balance?: number
          projected_expense?: number | null
          projected_income?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_forecasts_organization_id_fkey"
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
          expense_classification: string | null
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
          expense_classification?: string | null
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
          expense_classification?: string | null
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
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string | null
          id: string
          rate: number
          rate_date: string
          source: string | null
          target_currency: string
        }
        Insert: {
          base_currency: string
          created_at?: string | null
          id?: string
          rate: number
          rate_date: string
          source?: string | null
          target_currency: string
        }
        Update: {
          base_currency?: string
          created_at?: string | null
          id?: string
          rate?: number
          rate_date?: string
          source?: string | null
          target_currency?: string
        }
        Relationships: []
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
      financial_simulations: {
        Row: {
          created_at: string
          expense_increase_rate: number
          id: string
          initial_balance: number
          months_ahead: number
          name: string
          organization_id: string
          results: Json
          revenue_growth_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          expense_increase_rate?: number
          id?: string
          initial_balance?: number
          months_ahead?: number
          name?: string
          organization_id: string
          results?: Json
          revenue_growth_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          expense_increase_rate?: number
          id?: string
          initial_balance?: number
          months_ahead?: number
          name?: string
          organization_id?: string
          results?: Json
          revenue_growth_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_simulations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      integration_logs: {
        Row: {
          bank_connection_id: string | null
          created_at: string
          error_details: string | null
          event_type: string
          id: string
          ip_address: unknown
          message: string | null
          organization_id: string | null
          payload: Json | null
          provider: string
          status: string
          user_agent: string | null
        }
        Insert: {
          bank_connection_id?: string | null
          created_at?: string
          error_details?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          message?: string | null
          organization_id?: string | null
          payload?: Json | null
          provider?: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          bank_connection_id?: string | null
          created_at?: string
          error_details?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          message?: string | null
          organization_id?: string | null
          payload?: Json | null
          provider?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      materialized_metrics: {
        Row: {
          computed_at: string
          data: Json
          expires_at: string
          id: string
          metric_type: string
          organization_id: string
        }
        Insert: {
          computed_at?: string
          data?: Json
          expires_at?: string
          id?: string
          metric_type: string
          organization_id: string
        }
        Update: {
          computed_at?: string
          data?: Json
          expires_at?: string
          id?: string
          metric_type?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materialized_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      open_finance_accounts: {
        Row: {
          account_number: string | null
          account_type: string | null
          available_credit: number | null
          balance: number | null
          closing_day: number | null
          created_at: string
          credit_limit: number | null
          currency_code: string | null
          due_day: number | null
          id: string
          item_id: string
          last_sync_at: string | null
          local_account_id: string | null
          name: string
          organization_id: string
          pluggy_account_id: string
          raw_data: Json | null
          subtype: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          available_credit?: number | null
          balance?: number | null
          closing_day?: number | null
          created_at?: string
          credit_limit?: number | null
          currency_code?: string | null
          due_day?: number | null
          id?: string
          item_id: string
          last_sync_at?: string | null
          local_account_id?: string | null
          name: string
          organization_id: string
          pluggy_account_id: string
          raw_data?: Json | null
          subtype?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          available_credit?: number | null
          balance?: number | null
          closing_day?: number | null
          created_at?: string
          credit_limit?: number | null
          currency_code?: string | null
          due_day?: number | null
          id?: string
          item_id?: string
          last_sync_at?: string | null
          local_account_id?: string | null
          name?: string
          organization_id?: string
          pluggy_account_id?: string
          raw_data?: Json | null
          subtype?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_finance_accounts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "open_finance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_finance_accounts_local_account_id_fkey"
            columns: ["local_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_finance_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      open_finance_items: {
        Row: {
          connector_id: string | null
          consecutive_failures: number | null
          created_at: string
          error_code: string | null
          error_message: string | null
          execution_status: string | null
          id: string
          institution_name: string
          institution_type: string | null
          last_sync_at: string | null
          next_sync_at: string | null
          organization_id: string
          pluggy_item_id: string
          products: Json | null
          status: string
          sync_frequency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connector_id?: string | null
          consecutive_failures?: number | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          execution_status?: string | null
          id?: string
          institution_name: string
          institution_type?: string | null
          last_sync_at?: string | null
          next_sync_at?: string | null
          organization_id: string
          pluggy_item_id: string
          products?: Json | null
          status?: string
          sync_frequency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connector_id?: string | null
          consecutive_failures?: number | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          execution_status?: string | null
          id?: string
          institution_name?: string
          institution_type?: string | null
          last_sync_at?: string | null
          next_sync_at?: string | null
          organization_id?: string
          pluggy_item_id?: string
          products?: Json | null
          status?: string
          sync_frequency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_finance_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      open_finance_raw_data: {
        Row: {
          created_at: string
          data_type: string
          external_id: string | null
          id: string
          item_id: string | null
          organization_id: string
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          raw_json: Json
        }
        Insert: {
          created_at?: string
          data_type: string
          external_id?: string | null
          id?: string
          item_id?: string | null
          organization_id: string
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          raw_json: Json
        }
        Update: {
          created_at?: string
          data_type?: string
          external_id?: string | null
          id?: string
          item_id?: string | null
          organization_id?: string
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          raw_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "open_finance_raw_data_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "open_finance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_finance_raw_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      open_finance_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          id: string
          item_id: string | null
          metadata: Json | null
          organization_id: string
          records_failed: number | null
          records_fetched: number | null
          records_imported: number | null
          records_skipped: number | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          item_id?: string | null
          metadata?: Json | null
          organization_id: string
          records_failed?: number | null
          records_fetched?: number | null
          records_imported?: number | null
          records_skipped?: number | null
          started_at?: string
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          item_id?: string | null
          metadata?: Json | null
          organization_id?: string
          records_failed?: number | null
          records_fetched?: number | null
          records_imported?: number | null
          records_skipped?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_finance_sync_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "open_finance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_finance_sync_logs_organization_id_fkey"
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
      organization_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          organization_id: string
          plan_id: string
          started_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id: string
          plan_id: string
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          base_currency: string
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
          base_currency?: string
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
          base_currency?: string
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
      plans: {
        Row: {
          allow_anomaly_detection: boolean
          allow_benchmarking: boolean
          allow_forecast: boolean
          allow_simulator: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_ai_requests: number
          max_bank_connections: number
          max_reports_per_day: number | null
          max_sync_per_day: number | null
          max_transactions: number
          name: string
          price: number
          slug: string
          sort_order: number
        }
        Insert: {
          allow_anomaly_detection?: boolean
          allow_benchmarking?: boolean
          allow_forecast?: boolean
          allow_simulator?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_ai_requests?: number
          max_bank_connections?: number
          max_reports_per_day?: number | null
          max_sync_per_day?: number | null
          max_transactions?: number
          name: string
          price?: number
          slug: string
          sort_order?: number
        }
        Update: {
          allow_anomaly_detection?: boolean
          allow_benchmarking?: boolean
          allow_forecast?: boolean
          allow_simulator?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_ai_requests?: number
          max_bank_connections?: number
          max_reports_per_day?: number | null
          max_sync_per_day?: number | null
          max_transactions?: number
          name?: string
          price?: number
          slug?: string
          sort_order?: number
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
      recurring_expenses: {
        Row: {
          avg_amount: number
          category_id: string | null
          confidence: number | null
          created_at: string
          description: string
          frequency: string
          id: string
          is_active: boolean | null
          next_due_date: string | null
          occurrences: number | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          avg_amount?: number
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          description: string
          frequency?: string
          id?: string
          is_active?: boolean | null
          next_due_date?: string | null
          occurrences?: number | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          avg_amount?: number
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          description?: string
          frequency?: string
          id?: string
          is_active?: boolean | null
          next_due_date?: string | null
          occurrences?: number | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          organization_id: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_audit_logs: {
        Row: {
          api_balance: number | null
          balance_difference: number | null
          bank_connection_id: string | null
          created_at: string
          details: Json | null
          duplicates_detected: number | null
          id: string
          organization_id: string
          sync_date: string
          system_balance: number | null
          transactions_imported: number | null
          transactions_skipped: number | null
          transactions_total: number | null
        }
        Insert: {
          api_balance?: number | null
          balance_difference?: number | null
          bank_connection_id?: string | null
          created_at?: string
          details?: Json | null
          duplicates_detected?: number | null
          id?: string
          organization_id: string
          sync_date?: string
          system_balance?: number | null
          transactions_imported?: number | null
          transactions_skipped?: number | null
          transactions_total?: number | null
        }
        Update: {
          api_balance?: number | null
          balance_difference?: number | null
          bank_connection_id?: string | null
          created_at?: string
          details?: Json | null
          duplicates_detected?: number | null
          id?: string
          organization_id?: string
          sync_date?: string
          system_balance?: number | null
          transactions_imported?: number | null
          transactions_skipped?: number | null
          transactions_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_audit_logs_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_comments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
          anomaly_score: number | null
          bank_connection_id: string | null
          category_id: string | null
          classification_source: string | null
          converted_amount: number | null
          cost_center_id: string | null
          created_at: string
          date: string
          description: string | null
          due_date: string | null
          exchange_rate_used: number | null
          external_transaction_id: string | null
          financial_type: string | null
          id: string
          import_batch_id: string | null
          is_anomaly: boolean | null
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
          sync_dedup_key: string | null
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
          anomaly_score?: number | null
          bank_connection_id?: string | null
          category_id?: string | null
          classification_source?: string | null
          converted_amount?: number | null
          cost_center_id?: string | null
          created_at?: string
          date: string
          description?: string | null
          due_date?: string | null
          exchange_rate_used?: number | null
          external_transaction_id?: string | null
          financial_type?: string | null
          id?: string
          import_batch_id?: string | null
          is_anomaly?: boolean | null
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
          sync_dedup_key?: string | null
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
          anomaly_score?: number | null
          bank_connection_id?: string | null
          category_id?: string | null
          classification_source?: string | null
          converted_amount?: number | null
          cost_center_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          due_date?: string | null
          exchange_rate_used?: number | null
          external_transaction_id?: string | null
          financial_type?: string | null
          id?: string
          import_batch_id?: string | null
          is_anomaly?: boolean | null
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
          sync_dedup_key?: string | null
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
            foreignKeyName: "transactions_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
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
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_max_requests?: number
          p_organization_id: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      cleanup_expired_oauth_states: { Args: never; Returns: number }
      convert_currency: {
        Args: {
          p_amount: number
          p_from_currency: string
          p_rate_date?: string
          p_to_currency: string
        }
        Returns: number
      }
      detect_recurring_expenses: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      detect_transaction_anomalies: {
        Args: { p_lookback_days?: number; p_organization_id: string }
        Returns: Json
      }
      generate_cashflow_forecast: {
        Args: { p_days?: number; p_organization_id: string }
        Returns: Json
      }
      generate_financial_health_score: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      generate_financial_metrics: {
        Args: { p_organization_id: string; p_period?: string }
        Returns: Json
      }
      get_bank_concentration: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_consolidated_balance: {
        Args: { p_organization_id: string; p_target_currency?: string }
        Returns: Json
      }
      get_currency_exposure: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_lifestyle_pattern: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_patrimony_evolution: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_personal_runway: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_structured_liquidity: {
        Args: { p_organization_id: string }
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      text_similarity: {
        Args: { text1: string; text2: string }
        Returns: number
      }
      unaccent: { Args: { "": string }; Returns: string }
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
