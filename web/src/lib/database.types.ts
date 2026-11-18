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
      addresses: {
        Row: {
          address_line: string
          created_at: string
          district: string
          id: string
          is_default: boolean
          owner: string
          phone: string
          postcode: string
          province: string
          recipient_name: string
        }
        Insert: {
          address_line: string
          created_at?: string
          district?: string
          id?: string
          is_default?: boolean
          owner?: string
          phone: string
          postcode?: string
          province?: string
          recipient_name: string
        }
        Update: {
          address_line?: string
          created_at?: string
          district?: string
          id?: string
          is_default?: boolean
          owner?: string
          phone?: string
          postcode?: string
          province?: string
          recipient_name?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          address: string
          synced_at: string
        }
        Insert: {
          address: string
          synced_at?: string
        }
        Update: {
          address?: string
          synced_at?: string
        }
        Relationships: []
      }
      dispute_details: {
        Row: {
          admin_note: string | null
          created_at: string
          evidence: string[]
          order_id: number
          reason: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          evidence?: string[]
          order_id: number
          reason: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          evidence?: string[]
          order_id?: number
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: number
          log_index: number
          order_id: number | null
          product_id: number | null
          read: boolean
          recipient: string
          tx_hash: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: never
          log_index: number
          order_id?: number | null
          product_id?: number | null
          read?: boolean
          recipient: string
          tx_hash: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: never
          log_index?: number
          order_id?: number | null
          product_id?: number | null
          read?: boolean
          recipient?: string
          tx_hash?: string
          type?: string
        }
        Relationships: []
      }
      order_shipping: {
        Row: {
          address: string
          buyer: string
          created_at: string
          order_id: number
          phone: string
          recipient_name: string
        }
        Insert: {
          address: string
          buyer?: string
          created_at?: string
          order_id: number
          phone: string
          recipient_name: string
        }
        Update: {
          address?: string
          buyer?: string
          created_at?: string
          order_id?: number
          phone?: string
          recipient_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shipping_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer: string
          confirm_deadline: string | null
          dispute_reason_hash: string | null
          fee_bps: number
          id: number
          paid_at: string
          product_id: number
          quantity: number
          resolution_note: string | null
          resolution_refund: boolean | null
          reviewed: boolean
          seller: string
          ship_deadline: string
          shipped_at: string | null
          status: number
          synced_at: string
          total_wei: number
          tracking_no: string | null
          unit_price_wei: number
        }
        Insert: {
          buyer: string
          confirm_deadline?: string | null
          dispute_reason_hash?: string | null
          fee_bps: number
          id: number
          paid_at: string
          product_id: number
          quantity: number
          resolution_note?: string | null
          resolution_refund?: boolean | null
          reviewed?: boolean
          seller: string
          ship_deadline: string
          shipped_at?: string | null
          status: number
          synced_at?: string
          total_wei: number
          tracking_no?: string | null
          unit_price_wei: number
        }
        Update: {
          buyer?: string
          confirm_deadline?: string | null
          dispute_reason_hash?: string | null
          fee_bps?: number
          id?: number
          paid_at?: string
          product_id?: number
          quantity?: number
          resolution_note?: string | null
          resolution_refund?: boolean | null
          reviewed?: boolean
          seller?: string
          ship_deadline?: string
          shipped_at?: string | null
          status?: number
          synced_at?: string
          total_wei?: number
          tracking_no?: string | null
          unit_price_wei?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_details: {
        Row: {
          description: string
          images: string[]
          product_id: number
          specs: Json
          updated_at: string
        }
        Insert: {
          description?: string
          images?: string[]
          product_id: number
          specs?: Json
          updated_at?: string
        }
        Update: {
          description?: string
          images?: string[]
          product_id?: number
          specs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: number
          condition: number
          created_at: string
          details_hash: string
          hidden: boolean
          id: number
          price_wei: number
          seller: string
          stock: number
          synced_at: string
          title: string
          updated_at: string
        }
        Insert: {
          active: boolean
          category: number
          condition: number
          created_at: string
          details_hash: string
          hidden: boolean
          id: number
          price_wei: number
          seller: string
          stock: number
          synced_at?: string
          title: string
          updated_at: string
        }
        Update: {
          active?: boolean
          category?: number
          condition?: number
          created_at?: string
          details_hash?: string
          hidden?: boolean
          id?: number
          price_wei?: number
          seller?: string
          stock?: number
          synced_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string
          avatar_url: string | null
          created_at: string
          display_name: string | null
          shop_name: string | null
          updated_at: string
        }
        Insert: {
          address: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          shop_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          shop_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      review_comments: {
        Row: {
          comment: string
          created_at: string
          order_id: number
        }
        Insert: {
          comment: string
          created_at?: string
          order_id: number
        }
        Update: {
          comment?: string
          created_at?: string
          order_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          buyer: string
          comment_hash: string
          created_at: string
          order_id: number
          rating: number
          seller: string
          tx_hash: string
        }
        Insert: {
          buyer: string
          comment_hash: string
          created_at: string
          order_id: number
          rating: number
          seller: string
          tx_hash: string
        }
        Update: {
          buyer?: string
          comment_hash?: string
          created_at?: string
          order_id?: number
          rating?: number
          seller?: string
          tx_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          address: string
          banned: boolean
          rating_count: number
          rating_sum: number
          synced_at: string
          verified: boolean
        }
        Insert: {
          address: string
          banned?: boolean
          rating_count?: number
          rating_sum?: number
          synced_at?: string
          verified?: boolean
        }
        Update: {
          address?: string
          banned?: boolean
          rating_count?: number
          rating_sum?: number
          synced_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          chain_id: number
          contract_address: string
          id: number
          last_block: number
          last_run_at: string
        }
        Insert: {
          chain_id: number
          contract_address: string
          id?: number
          last_block: number
          last_run_at?: string
        }
        Update: {
          chain_id?: number
          contract_address?: string
          id?: number
          last_block?: number
          last_run_at?: string
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
    Enums: {},
  },
} as const
