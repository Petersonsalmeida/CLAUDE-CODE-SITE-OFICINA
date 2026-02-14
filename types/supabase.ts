
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          id: string
          user_id: string
          user: string
          action: string
          timestamp: string
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          user: string
          action: string
          timestamp?: string
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          user?: string
          action?: string
          timestamp?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          id: string
          user_id: string
          created_at: string
          name: string
          description: string
          value: number
          location: string
          acquisition_date: string
          photo: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          created_at?: string
          name: string
          description: string
          value: number
          location: string
          acquisition_date: string
          photo?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          name?: string
          description?: string
          value?: number
          location?: string
          acquisition_date?: string
          photo?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      car_parts: {
        Row: {
          id: string
          user_id: string
          created_at: string
          name: string
          description: string | null
          vehicle_model: string | null
          quantity: number
          location: string | null
          photo: string | null
          unit_price: number
          organization_id: string | null
        }
        Insert: {
          id: string
          user_id?: string
          created_at?: string
          name: string
          description?: string | null
          vehicle_model?: string | null
          quantity: number
          location?: string | null
          photo?: string | null
          unit_price: number
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          name?: string
          description?: string | null
          vehicle_model?: string | null
          quantity?: number
          location?: string | null
          photo?: string | null
          unit_price?: number
          organization_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          user_id: string
          created_at: string
          name: string
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          created_at?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          user_id: string
          created_at: string
          name: string
          cpf: string
          birth_date: string | null
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          created_at?: string
          name: string
          cpf: string
          birth_date?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          name?: string
          cpf?: string
          birth_date?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          user_id: string
          created_at: string
          name: string
          role: string
          contact: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          created_at?: string
          name: string
          role: string
          contact?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          name?: string
          role?: string
          contact?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      maintenance_records: {
        Row: {
          id: string
          user_id: string
          created_at: string
          asset_id: string
          date: string
          description: string
          cost: number
          type: string
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          created_at?: string
          asset_id: string
          date: string
          description: string
          cost: number
          type: string
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          asset_id?: string
          date?: string
          description?: string
          cost?: number
          type?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      nfs: {
        Row: {
          id: string
          user_id: string
          supplier: Json
          products: Json
          total_value: number
          import_date: string
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          supplier: Json
          products: Json
          total_value: number
          import_date: string
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          supplier?: Json
          products?: Json
          total_value?: number
          import_date?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }
        Insert: {
          id?: string
          name?: string
          invite_code?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          created_at?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          id: string
          user_id: string
          product_id: string
          price: number
          date: string
          supplier_name: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          product_id: string
          price: number
          date?: string
          supplier_name?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          price?: number
          date?: string
          supplier_name?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          user_id: string
          created_at: string
          name: string
          quantity: number
          unit_price: number
          category_id: string | null
          min_stock: number | null
          organization_id: string | null
        }
        Insert: {
          id: string
          user_id?: string
          created_at?: string
          name: string
          quantity: number
          unit_price: number
          category_id?: string | null
          min_stock?: number | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          name?: string
          quantity?: number
          unit_price?: number
          category_id?: string | null
          min_stock?: number | null
          organization_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          role: string
          organization_id: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          full_name: string
          role: string
          organization_id?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          role?: string
          organization_id?: string | null
          avatar_url?: string | null
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          id: string
          user_id: string
          supplier_id: string
          supplier_name: string
          status: string
          created_at: string
          items: Json
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          supplier_id: string
          supplier_name: string
          status: string
          created_at?: string
          items: Json
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          supplier_id?: string
          supplier_name?: string
          status?: string
          created_at?: string
          items?: Json
          organization_id?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          user_id: string
          title: string
          created_at: string
          items: Json
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          created_at?: string
          items: Json
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          created_at?: string
          items?: Json
          organization_id?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          id: string
          user_id: string
          product_id: string
          product_name: string
          type: string
          quantity: number
          date: string
          reason: string | null
          employee_id: string | null
          employee_name: string | null
          receipt_photo: string | null
          work_order_id: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          product_id: string
          product_name: string
          type: string
          quantity: number
          date: string
          reason?: string | null
          employee_id?: string | null
          employee_name?: string | null
          receipt_photo?: string | null
          work_order_id?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          product_name?: string
          type?: string
          quantity?: number
          date?: string
          reason?: string | null
          employee_id?: string | null
          employee_name?: string | null
          receipt_photo?: string | null
          work_order_id?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          user_id: string
          created_at: string
          name: string
          cnpj: string
          contact: string | null
          address: string | null
          whatsapp: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          created_at?: string
          name: string
          cnpj: string
          contact?: string | null
          address?: string | null
          whatsapp?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          name?: string
          cnpj?: string
          contact?: string | null
          address?: string | null
          whatsapp?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          id: string
          user_id: string
          title: string
          status: string
          created_at: string
          items: Json
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          status: string
          created_at?: string
          items: Json
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          status?: string
          created_at?: string
          items?: Json
          organization_id?: string | null
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
