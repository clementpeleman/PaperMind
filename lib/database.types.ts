export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type PaperStatus = 'unread' | 'reading' | 'read' | 'archived'
export type AnalysisType = 'overview' | 'methodology' | 'findings' | 'assessment' | 'impact' | 'personal' | 'custom'
export type TimelineActivityType = 'paper_added' | 'status_changed' | 'ai_analysis_completed' | 'note_added' | 'tag_added' | 'collection_changed' | 'ai_column_generated' | 'paper_deleted'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          supabase_user_id: string | null   // <-- toevoegen
          zotero_user_id: string
          zotero_username: string | null
          email: string | null
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
          last_login: string
        }
        Insert: {
          id?: string
          supabase_user_id?: string | null   // <-- toevoegen
          zotero_user_id: string
          zotero_username?: string | null
          email?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          last_login?: string
        }
        Update: {
          id?: string
          supabase_user_id?: string | null   // <-- toevoegen
          zotero_user_id?: string
          zotero_username?: string | null
          email?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          last_login?: string
        }
        Relationships: []
      }
      papers: {
        Row: {
          id: string
          user_id: string
          title: string
          authors: string[]
          journal: string | null
          year: number | null
          doi: string | null
          url: string | null
          zotero_key: string | null
          zotero_version: number | null
          tags: string[]
          collections: string[]
          notes: string
          status: PaperStatus
          date_added: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          authors?: string[]
          journal?: string | null
          year?: number | null
          doi?: string | null
          url?: string | null
          zotero_key?: string | null
          zotero_version?: number | null
          tags?: string[]
          collections?: string[]
          notes?: string
          status?: PaperStatus
          date_added?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          authors?: string[]
          journal?: string | null
          year?: number | null
          doi?: string | null
          url?: string | null
          zotero_key?: string | null
          zotero_version?: number | null
          tags?: string[]
          collections?: string[]
          notes?: string
          status?: PaperStatus
          date_added?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "papers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_columns: {
        Row: {
          id: string
          user_id: string
          name: string
          prompt: string
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          prompt: string
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          prompt?: string
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_columns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_column_values: {
        Row: {
          id: string
          user_id: string
          paper_id: string
          ai_column_id: string
          value: string | null
          generated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          paper_id: string
          ai_column_id: string
          value?: string | null
          generated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          paper_id?: string
          ai_column_id?: string
          value?: string | null
          generated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_column_values_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_column_values_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_column_values_ai_column_id_fkey"
            columns: ["ai_column_id"]
            isOneToOne: false
            referencedRelation: "ai_columns"
            referencedColumns: ["id"]
          }
        ]
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          supabase_user_id: string | null   // <-- toevoegen
          row_height_preset: string
          custom_row_height: number | null
          column_widths: Json
          column_visibility: Json
          zotero_user_id: string | null
          zotero_api_key: string | null
          last_zotero_sync: string | null
          ai_provider: string
          ai_columns?: any[];
          generated_content?: Record<string, any>;
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string                  // <-- optioneel maken
          supabase_user_id?: string | null  // <-- toevoegen
          row_height_preset?: string
          custom_row_height?: number | null
          column_widths?: Json
          column_visibility?: Json
          zotero_user_id?: string | null
          zotero_api_key?: string | null
          last_zotero_sync?: string | null
          ai_provider?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          supabase_user_id?: string | null  // <-- toevoegen
          row_height_preset?: string
          custom_row_height?: number | null
          column_widths?: Json
          column_visibility?: Json
          zotero_user_id?: string | null
          zotero_api_key?: string | null
          last_zotero_sync?: string | null
          ai_provider?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_supabase_user_id_fkey"
            columns: ["supabase_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["supabase_user_id"]
          }
        ]
      }
      paper_analysis: {
        Row: {
          id: string
          user_id: string
          paper_id: string
          analysis_type: AnalysisType
          analysis_title: string
          content: string
          prompt_used: string | null
          confidence_score: number | null
          processing_time_ms: number | null
          chunks_used: number | null
          model_used: string
          version: number
          is_active: boolean
          generated_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          paper_id: string
          analysis_type: AnalysisType
          analysis_title: string
          content: string
          prompt_used?: string | null
          confidence_score?: number | null
          processing_time_ms?: number | null
          chunks_used?: number | null
          model_used?: string
          version?: number
          is_active?: boolean
          generated_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          paper_id?: string
          analysis_type?: AnalysisType
          analysis_title?: string
          content?: string
          prompt_used?: string | null
          confidence_score?: number | null
          processing_time_ms?: number | null
          chunks_used?: number | null
          model_used?: string
          version?: number
          is_active?: boolean
          generated_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_analysis_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_analysis_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          }
        ]
      }
      timeline_activities: {
        Row: {
          id: string
          user_id: string
          paper_id: string
          activity_type: TimelineActivityType
          paper_title: string
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          paper_id: string
          activity_type: TimelineActivityType
          paper_title: string
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          paper_id?: string
          activity_type?: TimelineActivityType
          paper_title?: string
          details?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_activities_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_latest_paper_analysis: {
        Args: {
          p_user_id: string
          p_paper_id: string
          p_analysis_type: AnalysisType
        }
        Returns: {
          id: string
          content: string
          confidence_score: number | null
          generated_at: string
          version: number
        }[]
      }
      save_paper_analysis: {
        Args: {
          p_user_id: string
          p_paper_id: string
          p_analysis_type: AnalysisType
          p_analysis_title: string
          p_content: string
          p_prompt_used?: string | null
          p_confidence_score?: number | null
          p_processing_time_ms?: number | null
          p_chunks_used?: number | null
          p_model_used?: string
        }
        Returns: string
      }
      get_paper_analysis_summary: {
        Args: {
          p_user_id: string
          p_paper_id: string
        }
        Returns: {
          analysis_type: AnalysisType
          analysis_title: string
          content: string
          confidence_score: number | null
          generated_at: string
          version: number
          model_used: string
        }[]
      }
      log_timeline_activity: {
        Args: {
          p_user_id: string
          p_paper_id: string
          p_activity_type: TimelineActivityType
          p_paper_title: string
          p_details?: Json
        }
        Returns: string
      }
    }
    Enums: {
      paper_status: PaperStatus
      analysis_type: AnalysisType
      timeline_activity_type: TimelineActivityType
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type Paper = Database['public']['Tables']['papers']['Row']
export type PaperInsert = Database['public']['Tables']['papers']['Insert']
export type PaperUpdate = Database['public']['Tables']['papers']['Update']

export type AIColumn = Database['public']['Tables']['ai_columns']['Row']
export type AIColumnInsert = Database['public']['Tables']['ai_columns']['Insert']
export type AIColumnUpdate = Database['public']['Tables']['ai_columns']['Update']

export type AIColumnValue = Database['public']['Tables']['ai_column_values']['Row']
export type AIColumnValueInsert = Database['public']['Tables']['ai_column_values']['Insert']
export type AIColumnValueUpdate = Database['public']['Tables']['ai_column_values']['Update']

export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert']
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update']

export type PaperAnalysis = Database['public']['Tables']['paper_analysis']['Row']
export type PaperAnalysisInsert = Database['public']['Tables']['paper_analysis']['Insert']
export type PaperAnalysisUpdate = Database['public']['Tables']['paper_analysis']['Update']

export type TimelineActivity = Database['public']['Tables']['timeline_activities']['Row']
export type TimelineActivityInsert = Database['public']['Tables']['timeline_activities']['Insert']
export type TimelineActivityUpdate = Database['public']['Tables']['timeline_activities']['Update']

// Combined types for frontend usage
export type PaperWithAIColumns = Paper & {
  ai_columns?: Record<string, string>
}

export type AIColumnWithValues = AIColumn & {
  values?: AIColumnValue[]
}