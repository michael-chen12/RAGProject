// AUTO-GENERATED — regenerate after migrations with:
// supabase gen types typescript --project-id kdvjitqvjxxgsztzohix > src/types/database.types.ts

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
      chat_feedback: {
        Row: {
          created_at: string
          id: string
          message_id: string
          rating: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          rating: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          rating?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          citations: Json | null
          content: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["chat_role"]
          thread_id: string
        }
        Insert: {
          citations?: Json | null
          content: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["chat_role"]
          thread_id: string
        }
        Update: {
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["chat_role"]
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          visibility: Database["public"]["Enums"]["collection_visibility"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          visibility?: Database["public"]["Enums"]["collection_visibility"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          visibility?: Database["public"]["Enums"]["collection_visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          collection_id: string | null
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          token_count: number | null
          workspace_id: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          collection_id?: string | null
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          token_count?: number | null
          workspace_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          collection_id?: string | null
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          token_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          collection_id: string | null
          created_at: string
          error_message: string | null
          filename: string
          id: string
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          token_count: number | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          error_message?: string | null
          filename: string
          id?: string
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          token_count?: number | null
          user_id: string
          workspace_id: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          error_message?: string | null
          filename?: string
          id?: string
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string
          token_count?: number | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_cases: {
        Row: {
          eval_set_id: string
          expected_answer: string
          expected_source_ids: Json | null
          id: string
          question: string
        }
        Insert: {
          eval_set_id: string
          expected_answer: string
          expected_source_ids?: Json | null
          id?: string
          question: string
        }
        Update: {
          eval_set_id?: string
          expected_answer?: string
          expected_source_ids?: Json | null
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_cases_eval_set_id_fkey"
            columns: ["eval_set_id"]
            isOneToOne: false
            referencedRelation: "eval_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_runs: {
        Row: {
          answer_accuracy: number | null
          created_at: string
          details: Json | null
          eval_set_id: string
          hallucination_rate: number | null
          id: string
          k_value: number
          recall_at_k: number | null
        }
        Insert: {
          answer_accuracy?: number | null
          created_at?: string
          details?: Json | null
          eval_set_id: string
          hallucination_rate?: number | null
          id?: string
          k_value?: number
          recall_at_k?: number | null
        }
        Update: {
          answer_accuracy?: number | null
          created_at?: string
          details?: Json | null
          eval_set_id?: string
          hallucination_rate?: number | null
          id?: string
          k_value?: number
          recall_at_k?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eval_runs_eval_set_id_fkey"
            columns: ["eval_set_id"]
            isOneToOne: false
            referencedRelation: "eval_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_sets: {
        Row: {
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_sets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "eval_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invite_count: number | null
          invited_by: string
          last_sent_at: string | null
          reminder_sent_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          token: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invite_count?: number | null
          invited_by: string
          last_sent_at?: string | null
          reminder_sent_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invite_count?: number | null
          invited_by?: string
          last_sent_at?: string | null
          reminder_sent_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      missing_kb_entries: {
        Row: {
          context: string | null
          created_at: string
          id: string
          question: string
          workspace_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          question: string
          workspace_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          question?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missing_kb_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_agent_id: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          workspace_id: string
        }
        Insert: {
          assigned_agent_id?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          workspace_id: string
        }
        Update: {
          assigned_agent_id?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_chunks: {
        Args: {
          collection_ids: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
          workspace_id_arg: string
        }
        Returns: {
          chunk_index: number
          chunk_text: string
          collection_id: string
          document_id: string
          id: string
          similarity: number
          token_count: number
        }[]
      }
    }
    Enums: {
      chat_role: "user" | "assistant"
      collection_visibility: "public" | "private"
      doc_status: "processing" | "indexed" | "failed"
      member_role: "admin" | "agent" | "viewer"
      ticket_status: "open" | "pending" | "resolved"
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
      chat_role: ["user", "assistant"],
      collection_visibility: ["public", "private"],
      doc_status: ["processing", "indexed", "failed"],
      member_role: ["admin", "agent", "viewer"],
      ticket_status: ["open", "pending", "resolved"],
    },
  },
} as const
