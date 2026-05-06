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
      agent_runs: {
        Row: {
          businesses_found: number | null
          completed_at: string | null
          created_at: string | null
          emails_generated: number | null
          error_message: string | null
          id: string
          run_date: string
          search_location: string | null
          search_types: string[] | null
          status: string | null
        }
        Insert: {
          businesses_found?: number | null
          completed_at?: string | null
          created_at?: string | null
          emails_generated?: number | null
          error_message?: string | null
          id?: string
          run_date?: string
          search_location?: string | null
          search_types?: string[] | null
          status?: string | null
        }
        Update: {
          businesses_found?: number | null
          completed_at?: string | null
          created_at?: string | null
          emails_generated?: number | null
          error_message?: string | null
          id?: string
          run_date?: string
          search_location?: string | null
          search_types?: string[] | null
          status?: string | null
        }
        Relationships: []
      }
      agent_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      allowed_users: {
        Row: {
          accepted_at: string | null
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          name: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          called_at: string
          contact_reached: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          follow_up_date: string | null
          id: string
          notes: string | null
          outcome: string
          prospect_id: string
        }
        Insert: {
          called_at?: string
          contact_reached?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          outcome?: string
          prospect_id: string
        }
        Update: {
          called_at?: string
          contact_reached?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          outcome?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          prospect_id: string
          scheduled_for: string | null
          type: string
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          prospect_id: string
          scheduled_for?: string | null
          type: string
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          prospect_id?: string
          scheduled_for?: string | null
          type?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          sent_email_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          sent_email_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          sent_email_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_sent_email_id_fkey"
            columns: ["sent_email_id"]
            isOneToOne: false
            referencedRelation: "sent_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ingestion_log: {
        Row: {
          error_message: string | null
          from_email: string
          id: string
          message_id: string | null
          processed_at: string
          prospect_id: string | null
          status: string
          subject: string | null
        }
        Insert: {
          error_message?: string | null
          from_email: string
          id?: string
          message_id?: string | null
          processed_at?: string
          prospect_id?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          error_message?: string | null
          from_email?: string
          id?: string
          message_id?: string | null
          processed_at?: string
          prospect_id?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_ingestion_log_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      follow_up_rules: {
        Row: {
          ai_context: string | null
          created_at: string
          delay_hours: number
          email_template: string
          follow_up_number: number | null
          id: string
          is_active: boolean
          name: string
          subject_template: string
          trigger_condition: string
          use_ai_generation: boolean | null
        }
        Insert: {
          ai_context?: string | null
          created_at?: string
          delay_hours?: number
          email_template: string
          follow_up_number?: number | null
          id?: string
          is_active?: boolean
          name: string
          subject_template: string
          trigger_condition: string
          use_ai_generation?: boolean | null
        }
        Update: {
          ai_context?: string | null
          created_at?: string
          delay_hours?: number
          email_template?: string
          follow_up_number?: number | null
          id?: string
          is_active?: boolean
          name?: string
          subject_template?: string
          trigger_condition?: string
          use_ai_generation?: boolean | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      outreach_queue: {
        Row: {
          body: string
          email_type: string | null
          generated_at: string | null
          id: string
          notes: string | null
          prospect_id: string | null
          reviewed_at: string | null
          sent_at: string | null
          status: string | null
          subject: string
          to_email: string
        }
        Insert: {
          body: string
          email_type?: string | null
          generated_at?: string | null
          id?: string
          notes?: string | null
          prospect_id?: string | null
          reviewed_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          to_email: string
        }
        Update: {
          body?: string
          email_type?: string | null
          generated_at?: string | null
          id?: string
          notes?: string | null
          prospect_id?: string | null
          reviewed_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_queue_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      prospect_tasks: {
        Row: {
          completed: boolean
          created_at: string
          description: string
          due_date: string
          id: string
          prospect_id: string
          type: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          description: string
          due_date: string
          id?: string
          prospect_id: string
          type: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          prospect_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_tasks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          assigned_to: string | null
          business_name: string
          contact_name: string | null
          created_at: string
          do_not_contact: boolean
          do_not_contact_reason: string | null
          email: string | null
          email_recrawl_error: string | null
          email_recrawl_status: string | null
          email_recrawled_at: string | null
          email_source: string | null
          facebook_url: string | null
          id: string
          image_url: string | null
          industry: string | null
          instagram_url: string | null
          lead_score: number
          linkedin_url: string | null
          location: string
          moved_to_quoting: boolean
          next_follow_up: string | null
          notes: string | null
          phone: string | null
          raw_email_data: Json | null
          score_breakdown: Json | null
          score_updated_at: string | null
          services: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["prospect_status"]
          unsubscribed: boolean
          unsubscribed_at: string | null
          updated_at: string
          vehicle_count: number | null
          vehicle_types: string[] | null
          website: string | null
          yelp_url: string | null
        }
        Insert: {
          assigned_to?: string | null
          business_name: string
          contact_name?: string | null
          created_at?: string
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          email?: string | null
          email_recrawl_error?: string | null
          email_recrawl_status?: string | null
          email_recrawled_at?: string | null
          email_source?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          instagram_url?: string | null
          lead_score?: number
          linkedin_url?: string | null
          location: string
          moved_to_quoting?: boolean
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          raw_email_data?: Json | null
          score_breakdown?: Json | null
          score_updated_at?: string | null
          services?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["prospect_status"]
          unsubscribed?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          vehicle_count?: number | null
          vehicle_types?: string[] | null
          website?: string | null
          yelp_url?: string | null
        }
        Update: {
          assigned_to?: string | null
          business_name?: string
          contact_name?: string | null
          created_at?: string
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          email?: string | null
          email_recrawl_error?: string | null
          email_recrawl_status?: string | null
          email_recrawled_at?: string | null
          email_source?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          instagram_url?: string | null
          lead_score?: number
          linkedin_url?: string | null
          location?: string
          moved_to_quoting?: boolean
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          raw_email_data?: Json | null
          score_breakdown?: Json | null
          score_updated_at?: string | null
          services?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["prospect_status"]
          unsubscribed?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          vehicle_count?: number | null
          vehicle_types?: string[] | null
          website?: string | null
          yelp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      reply_intents: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          inbound_body: string | null
          inbound_message_id: string | null
          intent: string
          prospect_id: string | null
          sent_email_id: string | null
          status: string
          suggested_body: string | null
          suggested_subject: string | null
          urgency: string | null
          used_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          inbound_body?: string | null
          inbound_message_id?: string | null
          intent: string
          prospect_id?: string | null
          sent_email_id?: string | null
          status?: string
          suggested_body?: string | null
          suggested_subject?: string | null
          urgency?: string | null
          used_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          inbound_body?: string | null
          inbound_message_id?: string | null
          intent?: string
          prospect_id?: string | null
          sent_email_id?: string | null
          status?: string
          suggested_body?: string | null
          suggested_subject?: string | null
          urgency?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reply_intents_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          body: string
          created_at: string
          email_type: string | null
          id: string
          prospect_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          body: string
          created_at?: string
          email_type?: string | null
          id?: string
          prospect_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          body?: string
          created_at?: string
          email_type?: string | null
          id?: string
          prospect_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_follow_ups: {
        Row: {
          ai_generated: boolean | null
          body: string | null
          created_at: string
          follow_up_rule_id: string
          id: string
          prospect_id: string | null
          scheduled_for: string
          sent_at: string | null
          sent_email_id: string
          status: string
          subject: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          body?: string | null
          created_at?: string
          follow_up_rule_id: string
          id?: string
          prospect_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          sent_email_id: string
          status?: string
          subject?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          body?: string | null
          created_at?: string
          follow_up_rule_id?: string
          id?: string
          prospect_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          sent_email_id?: string
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_follow_ups_follow_up_rule_id_fkey"
            columns: ["follow_up_rule_id"]
            isOneToOne: false
            referencedRelation: "follow_up_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_follow_ups_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_follow_ups_sent_email_id_fkey"
            columns: ["sent_email_id"]
            isOneToOne: false
            referencedRelation: "sent_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          body: string | null
          click_count: number
          clicked_at: string | null
          email_type: string | null
          id: string
          open_count: number
          opened_at: string | null
          prospect_id: string | null
          replied_at: string | null
          resend_id: string | null
          sent_at: string
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          body?: string | null
          click_count?: number
          clicked_at?: string | null
          email_type?: string | null
          id?: string
          open_count?: number
          opened_at?: string | null
          prospect_id?: string | null
          replied_at?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          body?: string | null
          click_count?: number
          clicked_at?: string | null
          email_type?: string | null
          id?: string
          open_count?: number
          opened_at?: string | null
          prospect_id?: string | null
          replied_at?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_sms: {
        Row: {
          body: string
          created_by: string | null
          delivered_at: string | null
          error_message: string | null
          from_phone: string | null
          id: string
          prospect_id: string | null
          sent_at: string
          status: string
          to_phone: string
          twilio_sid: string | null
        }
        Insert: {
          body: string
          created_by?: string | null
          delivered_at?: string | null
          error_message?: string | null
          from_phone?: string | null
          id?: string
          prospect_id?: string | null
          sent_at?: string
          status?: string
          to_phone: string
          twilio_sid?: string | null
        }
        Update: {
          body?: string
          created_by?: string | null
          delivered_at?: string | null
          error_message?: string | null
          from_phone?: string | null
          id?: string
          prospect_id?: string | null
          sent_at?: string
          status?: string
          to_phone?: string
          twilio_sid?: string | null
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["team_role"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["team_role"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["team_role"]
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      can_access_prospect: { Args: { _prospect_id: string }; Returns: boolean }
      current_team_member_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "agent" | "va" | "sales_rep"
      lead_source:
        | "field_photo"
        | "email"
        | "referral"
        | "website"
        | "cold_call"
        | "csv_import"
      prospect_status:
        | "new"
        | "called"
        | "contacted"
        | "responded"
        | "qualified"
        | "quoted"
        | "closed"
      team_role: "agent" | "va" | "manager"
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
      app_role: ["admin", "agent", "va", "sales_rep"],
      lead_source: [
        "field_photo",
        "email",
        "referral",
        "website",
        "cold_call",
        "csv_import",
      ],
      prospect_status: [
        "new",
        "called",
        "contacted",
        "responded",
        "qualified",
        "quoted",
        "closed",
      ],
      team_role: ["agent", "va", "manager"],
    },
  },
} as const
