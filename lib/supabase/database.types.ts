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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_history: {
        Row: {
          created_at: string
          from_status: Database["public"]["Enums"]["approval_status"] | null
          id: number
          performed_by: string | null
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          to_status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          created_at?: string
          from_status?: Database["public"]["Enums"]["approval_status"] | null
          id?: never
          performed_by?: string | null
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          to_status: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          created_at?: string
          from_status?: Database["public"]["Enums"]["approval_status"] | null
          id?: never
          performed_by?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          to_status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "account_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          institution_id: string
          round_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          institution_id: string
          round_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          institution_id?: string
          round_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_round_id_institution_id_fkey"
            columns: ["round_id", "institution_id"]
            isOneToOne: true
            referencedRelation: "round_institutions"
            referencedColumns: ["round_id", "institution_id"]
          },
        ]
      }
      estimates: {
        Row: {
          estimate_values: Json
          id: string
          institution_type: string
          method_note: string
          round_id: string
          sample_count: number
        }
        Insert: {
          estimate_values: Json
          id?: string
          institution_type: string
          method_note: string
          round_id: string
          sample_count: number
        }
        Update: {
          estimate_values?: Json
          id?: string
          institution_type?: string
          method_note?: string
          round_id?: string
          sample_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimates_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "institution_round_results"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "estimates_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["round_id"]
          },
        ]
      }
      institution_indicators: {
        Row: {
          indicator_values: Json
          institution_id: string
          round_id: string
        }
        Insert: {
          indicator_values: Json
          institution_id: string
          round_id: string
        }
        Update: {
          indicator_values?: Json
          institution_id?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_indicators_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_indicators_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "institution_round_results"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "institution_indicators_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["round_id"]
          },
        ]
      }
      institution_types: {
        Row: {
          created_at: string
          name: string
        }
        Insert: {
          created_at?: string
          name: string
        }
        Update: {
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          institution_type: string | null
          name: string
          ykiho_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_type?: string | null
          name: string
          ykiho_code: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_type?: string | null
          name?: string
          ykiho_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutions_type_fk"
            columns: ["institution_type"]
            isOneToOne: false
            referencedRelation: "institution_types"
            referencedColumns: ["name"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          created_at: string
          email: string
          id: string
          institution_id: string | null
          name: string
          requested_institution_name: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          created_at?: string
          email: string
          id: string
          institution_id?: string | null
          name: string
          requested_institution_name?: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          created_at?: string
          email?: string
          id?: string
          institution_id?: string | null
          name?: string
          requested_institution_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_log: {
        Row: {
          action: Database["public"]["Enums"]["publish_action"]
          change_summary: string | null
          created_at: string
          id: number
          performed_by: string
          reason: string | null
          round_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["publish_action"]
          change_summary?: string | null
          created_at?: string
          id?: never
          performed_by: string
          reason?: string | null
          round_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["publish_action"]
          change_summary?: string | null
          created_at?: string
          id?: never
          performed_by?: string
          reason?: string | null
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_log_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "public_participation"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "publish_log_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "public_rounds"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "publish_log_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_metrics"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "publish_log_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_stats: {
        Row: {
          round_id: string
          source: string
          total_institution_count: number
          updated_at: string
        }
        Insert: {
          round_id: string
          source?: string
          total_institution_count: number
          updated_at?: string
        }
        Update: {
          round_id?: string
          source?: string
          total_institution_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_stats_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "public_participation"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "reference_stats_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "public_rounds"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "reference_stats_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "round_metrics"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "reference_stats_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_institutions: {
        Row: {
          created_at: string
          institution_id: string
          round_id: string
          surveyor_id: string | null
        }
        Insert: {
          created_at?: string
          institution_id: string
          round_id: string
          surveyor_id?: string | null
        }
        Update: {
          created_at?: string
          institution_id?: string
          round_id?: string
          surveyor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_institutions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_institutions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "public_participation"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_institutions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "public_rounds"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_institutions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_metrics"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_institutions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_institutions_surveyor_id_fkey"
            columns: ["surveyor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      round_results: {
        Row: {
          calculated_at: string
          published_at: string | null
          published_by: string | null
          round_id: string
          status: Database["public"]["Enums"]["result_status"]
          status_reason: string | null
          verified_at: string | null
          verified_by: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          calculated_at?: string
          published_at?: string | null
          published_by?: string | null
          round_id: string
          status?: Database["public"]["Enums"]["result_status"]
          status_reason?: string | null
          verified_at?: string | null
          verified_by?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          calculated_at?: string
          published_at?: string | null
          published_by?: string | null
          round_id?: string
          status?: Database["public"]["Enums"]["result_status"]
          status_reason?: string | null
          verified_at?: string | null
          verified_by?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_results_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "public_participation"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "public_rounds"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "round_metrics"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_withdrawn_by_fkey"
            columns: ["withdrawn_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          is_open: boolean
          name: string
          opened_at: string | null
          year: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          is_open?: boolean
          name: string
          opened_at?: string | null
          year: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          is_open?: boolean
          name?: string
          opened_at?: string | null
          year?: number
        }
        Relationships: []
      }
      submission_history: {
        Row: {
          created_at: string
          event: string
          id: number
          performed_by: string | null
          reason: string | null
          submission_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: never
          performed_by?: string | null
          reason?: string | null
          submission_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: never
          performed_by?: string | null
          reason?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          answers: Json
          id: string
          institution_id: string
          out_of_range_notes: Json
          return_reason: string | null
          returned_at: string | null
          round_id: string
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          id?: string
          institution_id: string
          out_of_range_notes?: Json
          return_reason?: string | null
          returned_at?: string | null
          round_id: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          id?: string
          institution_id?: string
          out_of_range_notes?: Json
          return_reason?: string | null
          returned_at?: string | null
          round_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_round_id_institution_id_fkey"
            columns: ["round_id", "institution_id"]
            isOneToOne: true
            referencedRelation: "round_institutions"
            referencedColumns: ["round_id", "institution_id"]
          },
        ]
      }
    }
    Views: {
      institution_comments: {
        Row: {
          body: string | null
          institution_id: string | null
          round_id: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          institution_id?: string | null
          round_id?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          institution_id?: string | null
          round_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_round_id_institution_id_fkey"
            columns: ["round_id", "institution_id"]
            isOneToOne: true
            referencedRelation: "round_institutions"
            referencedColumns: ["round_id", "institution_id"]
          },
        ]
      }
      institution_round_results: {
        Row: {
          published_at: string | null
          round_id: string | null
          status: Database["public"]["Enums"]["result_status"] | null
        }
        Insert: {
          published_at?: string | null
          round_id?: string | null
          status?: Database["public"]["Enums"]["result_status"] | null
        }
        Update: {
          published_at?: string | null
          round_id?: string | null
          status?: Database["public"]["Enums"]["result_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "public_participation"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "public_rounds"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "round_metrics"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      public_estimates: {
        Row: {
          estimate_values: Json | null
          institution_type: string | null
          method_note: string | null
          round_id: string | null
          sample_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "institution_round_results"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "estimates_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["round_id"]
          },
        ]
      }
      public_participation: {
        Row: {
          participation_rate_pct: number | null
          round_id: string | null
          submitted_count: number | null
          total_institution_count: number | null
        }
        Relationships: []
      }
      public_rounds: {
        Row: {
          published_at: string | null
          round_id: string | null
          round_name: string | null
          year: number | null
        }
        Relationships: []
      }
      round_metrics: {
        Row: {
          days_to_publish: number | null
          days_to_verify: number | null
          feedback_rate_pct: number | null
          first_published_at: string | null
          participation_rate_pct: number | null
          round_id: string | null
          round_name: string | null
          submitted_count: number | null
          survey_closed_at: string | null
          total_institution_count: number | null
          verified_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      app_institution_id: { Args: never; Returns: string }
      app_min_group_size: { Args: never; Returns: number }
      app_round_is_open: { Args: { target_round: string }; Returns: boolean }
      app_round_published: { Args: { target_round: string }; Returns: boolean }
      app_surveyor_assigned: {
        Args: { target_institution: string; target_round: string }
        Returns: boolean
      }
      app_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      review_signup: {
        Args: {
          p_decision: string
          p_institution_type?: string
          p_profile: string
        }
        Returns: undefined
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      publish_action: "publish" | "withdraw" | "republish"
      result_status: "calculated" | "verified" | "published" | "withdrawn"
      submission_status: "draft" | "submitted" | "returned"
      user_role: "surveyor" | "admin" | "institution"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      approval_status: ["pending", "approved", "rejected"],
      publish_action: ["publish", "withdraw", "republish"],
      result_status: ["calculated", "verified", "published", "withdrawn"],
      submission_status: ["draft", "submitted", "returned"],
      user_role: ["surveyor", "admin", "institution"],
    },
  },
} as const
