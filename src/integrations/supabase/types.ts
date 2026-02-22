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
          business_name: string
          created_at: string | null
          currency: string
          employee_count: number | null
          id: string
          monzo_access_token: string | null
          monzo_account_id: string | null
          monzo_connected: boolean | null
          onboarding_complete: boolean | null
          payroll_amount: number | null
          payroll_at_risk: boolean | null
          payroll_day: string | null
          payroll_frequency: string | null
          risk_level: string | null
          sector: string | null
          user_id: string
        }
        Insert: {
          business_name?: string
          created_at?: string | null
          currency?: string
          employee_count?: number | null
          id?: string
          monzo_access_token?: string | null
          monzo_account_id?: string | null
          monzo_connected?: boolean | null
          onboarding_complete?: boolean | null
          payroll_amount?: number | null
          payroll_at_risk?: boolean | null
          payroll_day?: string | null
          payroll_frequency?: string | null
          risk_level?: string | null
          sector?: string | null
          user_id: string
        }
        Update: {
          business_name?: string
          created_at?: string | null
          currency?: string
          employee_count?: number | null
          id?: string
          monzo_access_token?: string | null
          monzo_account_id?: string | null
          monzo_connected?: boolean | null
          onboarding_complete?: boolean | null
          payroll_amount?: number | null
          payroll_at_risk?: boolean | null
          payroll_day?: string | null
          payroll_frequency?: string | null
          risk_level?: string | null
          sector?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          account_id: string
          action_label: string | null
          action_type: string | null
          created_at: string | null
          dismissed: boolean | null
          id: string
          message: string
          title: string
          type: string
        }
        Insert: {
          account_id: string
          action_label?: string | null
          action_type?: string | null
          created_at?: string | null
          dismissed?: boolean | null
          id?: string
          message: string
          title: string
          type: string
        }
        Update: {
          account_id?: string
          action_label?: string | null
          action_type?: string | null
          created_at?: string | null
          dismissed?: boolean | null
          id?: string
          message?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          account_id: string
          client_name: string
          client_phone: string
          completed_at: string | null
          duration_seconds: number | null
          id: string
          initiated_at: string | null
          invoice_id: string | null
          outcome: string | null
          status: string | null
          transcript: string | null
        }
        Insert: {
          account_id: string
          client_name: string
          client_phone: string
          completed_at?: string | null
          duration_seconds?: number | null
          id?: string
          initiated_at?: string | null
          invoice_id?: string | null
          outcome?: string | null
          status?: string | null
          transcript?: string | null
        }
        Update: {
          account_id?: string
          client_name?: string
          client_phone?: string
          completed_at?: string | null
          duration_seconds?: number | null
          id?: string
          initiated_at?: string | null
          invoice_id?: string | null
          outcome?: string | null
          status?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_projections: {
        Row: {
          account_id: string
          id: string
          is_below_payroll_threshold: boolean | null
          is_below_zero: boolean | null
          projected_balance: number
          projection_date: string
        }
        Insert: {
          account_id: string
          id?: string
          is_below_payroll_threshold?: boolean | null
          is_below_zero?: boolean | null
          projected_balance: number
          projection_date: string
        }
        Update: {
          account_id?: string
          id?: string
          is_below_payroll_threshold?: boolean | null
          is_below_zero?: boolean | null
          projected_balance?: number
          projection_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_projections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          account_id: string
          content: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          account_id: string
          closed_at: string | null
          description: string | null
          events: Json | null
          id: string
          opened_at: string | null
          severity: string
          shortfall_amount: number | null
          status: string
          title: string
        }
        Insert: {
          account_id: string
          closed_at?: string | null
          description?: string | null
          events?: Json | null
          id?: string
          opened_at?: string | null
          severity?: string
          shortfall_amount?: number | null
          status?: string
          title: string
        }
        Update: {
          account_id?: string
          closed_at?: string | null
          description?: string | null
          events?: Json | null
          id?: string
          opened_at?: string | null
          severity?: string
          shortfall_amount?: number | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string
          amount: number
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          paid_at: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link: string | null
        }
        Insert: {
          account_id: string
          amount: number
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          paid_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          paid_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          created: string
          description: string | null
          id: string
          is_income: boolean | null
          merchant_name: string | null
        }
        Insert: {
          account_id: string
          amount: number
          category?: string | null
          created: string
          description?: string | null
          id: string
          is_income?: boolean | null
          merchant_name?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          created?: string
          description?: string | null
          id?: string
          is_income?: boolean | null
          merchant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
