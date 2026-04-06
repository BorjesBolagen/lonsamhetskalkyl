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
      Accounts: {
        Row: {
          name: string
          password: string
        }
        Insert: {
          name: string
          password: string
        }
        Update: {
          name?: string
          password?: string
        }
        Relationships: []
      }
      Addon: {
        Row: {
          addon_type: number
          addon_value: number
          shipment_id: number
        }
        Insert: {
          addon_type: number
          addon_value: number
          shipment_id: number
        }
        Update: {
          addon_type?: number
          addon_value?: number
          shipment_id?: number
        }
        Relationships: []
      }
      calculation_trappsteg: {
        Row: {
          forh_se_kundvis: number | null
          forh_se_radvis: number | null
          kndnto_medelse: number | null
          kndntofgrv: number
          kundnamn: string
          taxeprel: string
          vklfgrv: number
        }
        Insert: {
          forh_se_kundvis?: number | null
          forh_se_radvis?: number | null
          kndnto_medelse?: number | null
          kndntofgrv: number
          kundnamn: string
          taxeprel: string
          vklfgrv: number
        }
        Update: {
          forh_se_kundvis?: number | null
          forh_se_radvis?: number | null
          kndnto_medelse?: number | null
          kndntofgrv?: number
          kundnamn?: string
          taxeprel?: string
          vklfgrv?: number
        }
        Relationships: []
      }
      Historical_shipment: {
        Row: {
          admin_ID: string | null
          avbgsp_id: number
          comp_excl_addon: number
          comp_incl_addon: number
          customer_id: number | null
          customer_name: string | null
          date_completed: string
          DMT: number | null
          FLM: number | null
          imported_at: string
          line_number: number
          net_customer_freight: number
          receiver_city: string
          receiver_zip: number
          reg_number: string
          sender_city: string
          sender_zip: number
          shipment_id: number
          source_file_name: string
          upload_date: string
          volume: number | null
          weight: number
        }
        Insert: {
          admin_ID?: string | null
          avbgsp_id?: number
          comp_excl_addon: number
          comp_incl_addon: number
          customer_id?: number | null
          customer_name?: string | null
          date_completed: string
          DMT?: number | null
          FLM?: number | null
          imported_at: string
          line_number: number
          net_customer_freight: number
          receiver_city: string
          receiver_zip: number
          reg_number: string
          sender_city: string
          sender_zip: number
          shipment_id: number
          source_file_name: string
          upload_date: string
          volume?: number | null
          weight: number
        }
        Update: {
          admin_ID?: string | null
          avbgsp_id?: number
          comp_excl_addon?: number
          comp_incl_addon?: number
          customer_id?: number | null
          customer_name?: string | null
          date_completed?: string
          DMT?: number | null
          FLM?: number | null
          imported_at?: string
          line_number?: number
          net_customer_freight?: number
          receiver_city?: string
          receiver_zip?: number
          reg_number?: string
          sender_city?: string
          sender_zip?: number
          shipment_id?: number
          source_file_name?: string
          upload_date?: string
          volume?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "Historical_shipment_admin_ID_fkey"
            columns: ["admin_ID"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: number
          message: string | null
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          message?: string | null
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          message?: string | null
          sent_at?: string | null
        }
        Relationships: []
      }
      pricing_parameter: {
        Row: {
          admin_ID: string | null
          from: string
          min_price: number
          price_per_flm: number
          price_per_ten_km: number
          to: string
        }
        Insert: {
          admin_ID?: string | null
          from?: string
          min_price: number
          price_per_flm: number
          price_per_ten_km: number
          to?: string
        }
        Update: {
          admin_ID?: string | null
          from?: string
          min_price?: number
          price_per_flm?: number
          price_per_ten_km?: number
          to?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_parameter_admin_ID_fkey"
            columns: ["admin_ID"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Truck: {
        Row: {
          capacity: number
          internal_number: number
          reg_number: string
        }
        Insert: {
          capacity: number
          internal_number: number
          reg_number: string
        }
        Update: {
          capacity?: number
          internal_number?: number
          reg_number?: string
        }
        Relationships: []
      }
      User: {
        Row: {
          areas: Json | null
          email: string
          email_verified: boolean | null
          filters: Json | null
          id: string
          role: Database["public"]["Enums"]["User_specialization_types"] | null
          threshold: number | null
        }
        Insert: {
          areas?: Json | null
          email: string
          email_verified?: boolean | null
          filters?: Json | null
          id?: string
          role?: Database["public"]["Enums"]["User_specialization_types"] | null
          threshold?: number | null
        }
        Update: {
          areas?: Json | null
          email?: string
          email_verified?: boolean | null
          filters?: Json | null
          id?: string
          role?: Database["public"]["Enums"]["User_specialization_types"] | null
          threshold?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_traffic_leader: { Args: { user_id: string }; Returns: boolean }
    }
    Enums: {
      User_specialization_types: "admin" | "traffic_leader"
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
      User_specialization_types: ["admin", "traffic_leader"],
    },
  },
} as const
