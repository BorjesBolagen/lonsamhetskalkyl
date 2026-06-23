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
      Addons: {
        Row: {
          carriers_share: number | null
          Class: number | null
          id: number
          name: string | null
          weight_from: number | null
          weight_to: number | null
        }
        Insert: {
          carriers_share?: number | null
          Class?: number | null
          id?: number
          name?: string | null
          weight_from?: number | null
          weight_to?: number | null
        }
        Update: {
          carriers_share?: number | null
          Class?: number | null
          id?: number
          name?: string | null
          weight_from?: number | null
          weight_to?: number | null
        }
        Relationships: []
      }
      addons_postal: {
        Row: {
          balanstillagg: string | null
          id: number
          orttillagg: string | null
          postort: string | null
          stor: string | null
          taxepunkt: number
        }
        Insert: {
          balanstillagg?: string | null
          id?: number
          orttillagg?: string | null
          postort?: string | null
          stor?: string | null
          taxepunkt: number
        }
        Update: {
          balanstillagg?: string | null
          id?: number
          orttillagg?: string | null
          postort?: string | null
          stor?: string | null
          taxepunkt?: number
        }
        Relationships: []
      }
      calculation_medelse: {
        Row: {
          km_bucket: number
          kndnto_medelse: number
          vklfgrv: number
        }
        Insert: {
          km_bucket: number
          kndnto_medelse: number
          vklfgrv: number
        }
        Update: {
          km_bucket?: number
          kndnto_medelse?: number
          vklfgrv?: number
        }
        Relationships: []
      }
      calculation_trappsteg: {
        Row: {
          forh_se_kundvis: number | null
          forh_se_radvis: number | null
          km: number | null
          kndntofgrv: number
          kundnamn: string
          taxeprel: string
          vklfgrv: number
        }
        Insert: {
          forh_se_kundvis?: number | null
          forh_se_radvis?: number | null
          km?: number | null
          kndntofgrv: number
          kundnamn: string
          taxeprel: string
          vklfgrv: number
        }
        Update: {
          forh_se_kundvis?: number | null
          forh_se_radvis?: number | null
          km?: number | null
          kndntofgrv?: number
          kundnamn?: string
          taxeprel?: string
          vklfgrv?: number
        }
        Relationships: []
      }
      distance_map: {
        Row: {
          distance: number
          receiver: number
          sender: number
        }
        Insert: {
          distance: number
          receiver: number
          sender: number
        }
        Update: {
          distance?: number
          receiver?: number
          sender?: number
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
          forh_SE_radvis: number | null
          imported_at: string
          line_number: number
          net_customer_freight: number
          office_relation: string | null
          receiver_city: string
          receiver_taxep: number | null
          receiver_zip: number
          reg_number: string
          sender_city: string
          sender_taxep: number | null
          sender_zip: number
          shipment_id: number
          source_file_name: string
          upload_date: string
          weight: number
          weight_class: number | null
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
          forh_SE_radvis?: number | null
          imported_at: string
          line_number: number
          net_customer_freight: number
          office_relation?: string | null
          receiver_city: string
          receiver_taxep?: number | null
          receiver_zip: number
          reg_number: string
          sender_city: string
          sender_taxep?: number | null
          sender_zip: number
          shipment_id: number
          source_file_name: string
          upload_date: string
          weight: number
          weight_class?: number | null
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
          forh_SE_radvis?: number | null
          imported_at?: string
          line_number?: number
          net_customer_freight?: number
          office_relation?: string | null
          receiver_city?: string
          receiver_taxep?: number | null
          receiver_zip?: number
          reg_number?: string
          sender_city?: string
          sender_taxep?: number | null
          sender_zip?: number
          shipment_id?: number
          source_file_name?: string
          upload_date?: string
          weight?: number
          weight_class?: number | null
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
      import_jobs: {
        Row: {
          admin_id: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          inserted_row_count: number | null
          rows_failed: number | null
          rows_processed: number | null
          rows_total: number | null
          rows_valid: number | null
          status: string
          storage_path: string | null
          updated_at: string | null
          validation_errors: string[] | null
        }
        Insert: {
          admin_id: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          inserted_row_count?: number | null
          rows_failed?: number | null
          rows_processed?: number | null
          rows_total?: number | null
          rows_valid?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
          validation_errors?: string[] | null
        }
        Update: {
          admin_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          inserted_row_count?: number | null
          rows_failed?: number | null
          rows_processed?: number | null
          rows_total?: number | null
          rows_valid?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
          validation_errors?: string[] | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: number
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      name_translation: {
        Row: {
          ilog_name: string
          kusk_customer_id: number | null
          kusk_name: string
          receiver_taxep: number
          sender_taxep: number
          upload_date: string | null
        }
        Insert: {
          ilog_name: string
          kusk_customer_id?: number | null
          kusk_name: string
          receiver_taxep: number
          sender_taxep: number
          upload_date?: string | null
        }
        Update: {
          ilog_name?: string
          kusk_customer_id?: number | null
          kusk_name?: string
          receiver_taxep?: number
          sender_taxep?: number
          upload_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "name_translation_receiver_taxep_fkey"
            columns: ["receiver_taxep"]
            isOneToOne: false
            referencedRelation: "taxepunkter"
            referencedColumns: ["taxepunktspostnummer"]
          },
          {
            foreignKeyName: "name_translation_sender_taxep_fkey"
            columns: ["sender_taxep"]
            isOneToOne: false
            referencedRelation: "taxepunkter"
            referencedColumns: ["taxepunktspostnummer"]
          },
        ]
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
      sunes_pricing: {
        Row: {
          avs_ort: string | null
          avsandare: string | null
          avsandarplats: string | null
          genomsnittspris: number | null
          lookup: string
          mott_ort: string | null
          mottagare: string | null
          mottagarplats: string | null
        }
        Insert: {
          avs_ort?: string | null
          avsandare?: string | null
          avsandarplats?: string | null
          genomsnittspris?: number | null
          lookup: string
          mott_ort?: string | null
          mottagare?: string | null
          mottagarplats?: string | null
        }
        Update: {
          avs_ort?: string | null
          avsandare?: string | null
          avsandarplats?: string | null
          genomsnittspris?: number | null
          lookup?: string
          mott_ort?: string | null
          mottagare?: string | null
          mottagarplats?: string | null
        }
        Relationships: []
      }
      tax_point_lookup: {
        Row: {
          kontor: string | null
          kontorsforkortning: string | null
          postnummer: number
          postort: string | null
          taxepunkt: string | null
          taxepunktspostnummer: number | null
        }
        Insert: {
          kontor?: string | null
          kontorsforkortning?: string | null
          postnummer: number
          postort?: string | null
          taxepunkt?: string | null
          taxepunktspostnummer?: number | null
        }
        Update: {
          kontor?: string | null
          kontorsforkortning?: string | null
          postnummer?: number
          postort?: string | null
          taxepunkt?: string | null
          taxepunktspostnummer?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tax_point_lookup_taxepunkt"
            columns: ["taxepunktspostnummer"]
            isOneToOne: false
            referencedRelation: "taxepunkter"
            referencedColumns: ["taxepunktspostnummer"]
          },
        ]
      }
      taxepunkter: {
        Row: {
          taxepunktsnamn: string
          taxepunktspostnummer: number
        }
        Insert: {
          taxepunktsnamn: string
          taxepunktspostnummer?: number
        }
        Update: {
          taxepunktsnamn?: string
          taxepunktspostnummer?: number
        }
        Relationships: []
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
          email: string
          email_verified: boolean | null
          filters: Json | null
          first_name: string | null
          id: string
          last_name: string | null
          last_read_messages_at: string | null
          role: Database["public"]["Enums"]["User_specialization_types"] | null
        }
        Insert: {
          email: string
          email_verified?: boolean | null
          filters?: Json | null
          first_name?: string | null
          id: string
          last_name?: string | null
          last_read_messages_at?: string | null
          role?: Database["public"]["Enums"]["User_specialization_types"] | null
        }
        Update: {
          email?: string
          email_verified?: boolean | null
          filters?: Json | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_read_messages_at?: string | null
          role?: Database["public"]["Enums"]["User_specialization_types"] | null
        }
        Relationships: []
      }
      vikt_till_viktklass: {
        Row: {
          class: number | null
          max_weight: number
          min_weight: number
        }
        Insert: {
          class?: number | null
          max_weight: number
          min_weight: number
        }
        Update: {
          class?: number | null
          max_weight?: number
          min_weight?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_applicable_addons: {
        Args: {
          p_chargeable_weight: number
          p_receiver_postort: string
          p_receiver_taxepunkt: string
          p_sender_postort: string
          p_sender_taxepunkt: string
        }
        Returns: Json
      }
      dedupe_historical_shipment_after_import: {
        Args: { in_source_file_name?: string }
        Returns: number
      }
      fill_name_translation_from_consignments: {
        Args: { in_data: Json; in_date: string }
        Returns: {
          inserted: number
          skipped: number
        }[]
      }
      find_best_name_match: {
        Args: { input_name: string }
        Returns: {
          best_name: string
          best_score: number
        }[]
      }
      get_amount_of_unread_messages: {
        Args: { user_id: string }
        Returns: number
      }
      get_distance: {
        Args: { in_receiver_taxep: number; in_sender_taxep: number }
        Returns: number
      }
      get_entire_vkl_table: {
        Args: never
        Returns: {
          max: number
          min: number
          vkl: number
        }[]
      }
      get_medel_forh_kundvis:
        | { Args: { in_kundnamn: string }; Returns: number }
        | {
            Args: { in_kundnamn: string; in_use_entire_name?: boolean }
            Returns: number
          }
      get_medel_se: {
        Args: { in_kilometer: number; in_viktklass: number }
        Returns: number
      }
      get_office_for_taxep: { Args: { in_taxep: number }; Returns: string }
      get_snitt_forh_se_radvis:
        | { Args: { in_kundnamn: string; in_weight: number }; Returns: number }
        | {
            Args: {
              in_kundnamn: string
              in_use_entire_name?: boolean
              in_weight: number
            }
            Returns: number
          }
      get_taxep: { Args: { in_postal_code: number }; Returns: number }
      get_weight_class: { Args: { input_weight: number }; Returns: number }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_traffic_leader: { Args: { user_id: string }; Returns: boolean }
      jaro_winkler: { Args: { s1: string; s2: string }; Returns: number }
      names_match: {
        Args: { name_a: string; name_b: string }
        Returns: boolean
      }
      normalize_addon_postort: { Args: { p_value: string }; Returns: string }
      normalize_addon_taxepunkt: { Args: { p_value: string }; Returns: string }
      resolve_addon_location: {
        Args: { p_postort: string; p_taxepunkt: string }
        Returns: {
          balance_ambiguous: boolean
          has_balance_addon: boolean
          match_source: string
          matched_postort: string
          matched_rows: number
          matched_taxepunkt: string
          orttillagg_ambiguous: boolean
          orttillagg_class: number
          stor: string
          stor_ambiguous: boolean
        }[]
      }
      round_up_weight: { Args: { input_weight: number }; Returns: number }
      run_test_steg_1: {
        Args: {
          in_input_weight: number
          in_name: string
          in_taxep_receiver: number
          in_taxep_sender: number
        }
        Returns: {
          kundnettofrakt: number
          vikt: number
        }[]
      }
      run_test_steg_2: {
        Args: {
          in_input_weight: number
          in_name: string
          in_taxep_receiver: number
          in_taxep_sender: number
        }
        Returns: Database["public"]["CompositeTypes"]["steg_2_result"]
        SetofOptions: {
          from: "*"
          to: "steg_2_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_test_steg_3: {
        Args: {
          in_input_weight: number
          in_name: string
          in_taxep_receiver: number
          in_taxep_sender: number
        }
        Returns: Database["public"]["CompositeTypes"]["steg_3_result"]
        SetofOptions: {
          from: "*"
          to: "steg_3_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_test_steg_4: {
        Args: {
          in_receiver_taxep: number
          in_sender_taxep: number
          in_weight: number
        }
        Returns: {
          sum_kundnetto: number
          sum_vikt: number
        }[]
      }
      run_test_steg_5: {
        Args: {
          in_receiver_taxep: number
          in_sender_taxep: number
          in_weight: number
        }
        Returns: {
          forh_linjevis: number
          medel_se: number
        }[]
      }
      steg_1: {
        Args: {
          in_input_weight: number
          in_name: string
          in_taxep_receiver: number
          in_taxep_sender: number
        }
        Returns: {
          kundnettofrakt: number
          vikt: number
        }[]
      }
      steg_2: {
        Args: {
          in_input_weight: number
          in_name: string
          in_taxep_receiver: number
          in_taxep_sender: number
        }
        Returns: Database["public"]["CompositeTypes"]["steg_2_result"]
        SetofOptions: {
          from: "*"
          to: "steg_2_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      steg_3: {
        Args: {
          in_kundnamn: string
          in_taxep_receiver: number
          in_taxep_sender: number
          in_weight: number
        }
        Returns: Database["public"]["CompositeTypes"]["steg_3_result"]
        SetofOptions: {
          from: "*"
          to: "steg_3_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      steg_4: {
        Args: {
          in_receiver_taxep: number
          in_sender_taxep: number
          in_weight: number
        }
        Returns: {
          sum_kundnetto: number
          sum_vikt: number
        }[]
      }
      steg_5: {
        Args: {
          in_receiver_taxep: number
          in_sender_taxep: number
          in_weight: number
        }
        Returns: {
          forh_linjevis: number
          medel_se: number
        }[]
      }
      update_last_read_messages: {
        Args: { user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      User_specialization_types: "admin" | "traffic_leader"
    }
    CompositeTypes: {
      steg_2_result: {
        medel_se_faktor: number | null
        snitt_kund_vkl_forh_se: number | null
      }
      steg_3_result: {
        medel_se_faktor: number | null
        medel_forh_se_kundvis: number | null
      }
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
