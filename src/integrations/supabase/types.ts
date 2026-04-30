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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          alert_id: string
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at: string
          id: string
          message: string
          read: boolean
          symbol: string
          threshold: number
          user_id: string
          value_at_trigger: number
        }
        Insert: {
          alert_id: string
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          message: string
          read?: boolean
          symbol: string
          threshold: number
          user_id: string
          value_at_trigger: number
        }
        Update: {
          alert_id?: string
          alert_type?: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          symbol?: string
          threshold?: number
          user_id?: string
          value_at_trigger?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          active: boolean
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at: string
          id: string
          last_fired_at: string | null
          symbol: string
          threshold: number
          user_id: string
        }
        Insert: {
          active?: boolean
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          last_fired_at?: string | null
          symbol: string
          threshold: number
          user_id: string
        }
        Update: {
          active?: boolean
          alert_type?: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          last_fired_at?: string | null
          symbol?: string
          threshold?: number
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          app_version: string | null
          component_stack: string | null
          created_at: string
          id: string
          message: string
          route: string | null
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          component_stack?: string | null
          created_at?: string
          id?: string
          message: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          component_stack?: string | null
          created_at?: string
          id?: string
          message?: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      holdings: {
        Row: {
          cost_basis: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          shares: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_basis: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          shares: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_basis?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          shares?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alert_type:
        | "price_above"
        | "price_below"
        | "rsi_above"
        | "rsi_below"
        | "near_52w_high"
        | "near_52w_low"
        | "pct_change_above"
        | "pct_change_below"
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
      alert_type: [
        "price_above",
        "price_below",
        "rsi_above",
        "rsi_below",
        "near_52w_high",
        "near_52w_low",
        "pct_change_above",
        "pct_change_below",
      ],
    },
  },
} as const
