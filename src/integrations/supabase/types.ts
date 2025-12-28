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
      app_settings: {
        Row: {
          accent_color: string | null
          app_name: string
          created_at: string
          email_notifications_enabled: boolean | null
          font_family: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          whatsapp_notifications_enabled: boolean | null
        }
        Insert: {
          accent_color?: string | null
          app_name?: string
          created_at?: string
          email_notifications_enabled?: boolean | null
          font_family?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          whatsapp_notifications_enabled?: boolean | null
        }
        Update: {
          accent_color?: string | null
          app_name?: string
          created_at?: string
          email_notifications_enabled?: boolean | null
          font_family?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          whatsapp_notifications_enabled?: boolean | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_type: string
          check_in_time: string
          check_out_time: string | null
          created_at: string
          date: string
          id: string
          session_name: string | null
          user_id: string
        }
        Insert: {
          attendance_type: string
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          session_name?: string | null
          user_id: string
        }
        Update: {
          attendance_type?: string
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          session_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          record_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          record_id: string
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          record_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          expiry_date: string | null
          file_url: string | null
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submission_notes: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_notes?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_notes?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ecommerce_setups: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          platform: string | null
          status: string
          store_details: string | null
          store_name: string | null
          store_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          platform?: string | null
          status?: string
          store_details?: string | null
          store_name?: string | null
          store_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          platform?: string | null
          status?: string
          store_details?: string | null
          store_name?: string | null
          store_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enrollment_submissions: {
        Row: {
          address: string
          attachment_url: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string
          status: string
          submitted_at: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          address: string
          attachment_url?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          address?: string
          attachment_url?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      journey_stages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          stage_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          stage_order: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          stage_order?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      participant_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          stage_id: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          stage_id: string
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          stage_id?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_progress_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_coach_id: string | null
          avatar_url: string | null
          batch_number: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          unique_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_coach_id?: string | null
          avatar_url?: string | null
          batch_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          unique_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_coach_id?: string | null
          avatar_url?: string | null
          batch_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          unique_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_navigation_settings: {
        Row: {
          created_at: string
          custom_label: string | null
          display_order: number
          icon_name: string
          id: string
          is_custom: boolean
          is_default: boolean
          is_external: boolean
          is_visible: boolean
          label_key: string
          page_path: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_label?: string | null
          display_order?: number
          icon_name: string
          id?: string
          is_custom?: boolean
          is_default?: boolean
          is_external?: boolean
          is_visible?: boolean
          label_key: string
          page_path: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_label?: string | null
          display_order?: number
          icon_name?: string
          id?: string
          is_custom?: boolean
          is_default?: boolean
          is_external?: boolean
          is_visible?: boolean
          label_key?: string
          page_path?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          location: string | null
          name: string
          scheduled_at: string | null
          session_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
          scheduled_at?: string | null
          session_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
          scheduled_at?: string | null
          session_type?: string
        }
        Relationships: []
      }
      special_session_links: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_completed: boolean | null
          link_url: string
          session_type: string
          target_batch: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_completed?: boolean | null
          link_url: string
          session_type?: string
          target_batch?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_completed?: boolean | null
          link_url?: string
          session_type?: string
          target_batch?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      task_submissions: {
        Row: {
          attachment_url: string | null
          created_at: string
          id: string
          status: string
          submission_notes: string | null
          submitted_at: string | null
          task_id: string
          updated_at: string
          user_id: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          status?: string
          submission_notes?: string | null
          submitted_at?: string | null
          task_id: string
          updated_at?: string
          user_id: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          status?: string
          submission_notes?: string | null
          submitted_at?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          guidelines: string | null
          id: string
          is_active: boolean | null
          stage_id: string | null
          task_order: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          guidelines?: string | null
          id?: string
          is_active?: boolean | null
          stage_id?: string | null
          task_order: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          guidelines?: string | null
          id?: string
          is_active?: boolean | null
          stage_id?: string | null
          task_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          amount: number
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          country: string
          created_at: string
          currency: string | null
          id: string
          notes: string | null
          product_service: string
          state: string | null
          status: string
          trade_date: string
          trade_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          country: string
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          product_service: string
          state?: string | null
          status?: string
          trade_date: string
          trade_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          country?: string
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          product_service?: string
          state?: string | null
          status?: string
          trade_date?: string
          trade_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_session_completions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          marked_by: string | null
          notes: string | null
          session_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          session_type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          session_type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_unique_id: { Args: { p_user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      regenerate_unique_id: { Args: { p_user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "coach" | "participant" | "ecommerce" | "finance"
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
      app_role: ["admin", "coach", "participant", "ecommerce", "finance"],
    },
  },
} as const
