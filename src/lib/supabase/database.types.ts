// Generated from the Supabase schema. Regenerate after every migration:
//   pnpm db:types
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
      appointment_items: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          list_price_usd: number
          price_usd: number
          professional_id: string | null
          service_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          list_price_usd: number
          price_usd: number
          professional_id?: string | null
          service_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          list_price_usd?: number
          price_usd?: number
          professional_id?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_balances"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "appointment_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          notes: string | null
          patient_id: string
          patient_notes: string | null
          source: string
          starts_at: string
          starts_on: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id: string
          patient_notes?: string | null
          source?: string
          starts_at: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id?: string
          patient_notes?: string | null
          source?: string
          starts_at?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_attempts: {
        Row: {
          calendar_id: string | null
          client_hash: string | null
          created_at: string
          id: number
        }
        Insert: {
          calendar_id?: string | null
          client_hash?: string | null
          created_at?: string
          id?: never
        }
        Update: {
          calendar_id?: string | null
          client_hash?: string | null
          created_at?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "booking_attempts_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_hours: {
        Row: {
          calendar_id: string
          ends: string
          starts: string
          weekday: number
        }
        Insert: {
          calendar_id: string
          ends: string
          starts: string
          weekday: number
        }
        Update: {
          calendar_id?: string
          ends?: string
          starts?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_hours_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_overrides: {
        Row: {
          calendar_id: string
          created_at: string
          day: string
          ends: string | null
          id: string
          note: string | null
          starts: string | null
        }
        Insert: {
          calendar_id: string
          created_at?: string
          day: string
          ends?: string | null
          id?: string
          note?: string | null
          starts?: string | null
        }
        Update: {
          calendar_id?: string
          created_at?: string
          day?: string
          ends?: string | null
          id?: string
          note?: string | null
          starts?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_overrides_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_services: {
        Row: {
          calendar_id: string
          duration_minutes: number
          position: number
          service_id: string
        }
        Insert: {
          calendar_id: string
          duration_minutes?: number
          position?: number
          service_id: string
        }
        Update: {
          calendar_id?: string
          duration_minutes?: number
          position?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_services_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          accepting: boolean
          created_at: string
          horizon_days: number
          id: string
          intro: string | null
          min_notice_hours: number
          professional_id: string
          slug: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          accepting?: boolean
          created_at?: string
          horizon_days?: number
          id?: string
          intro?: string | null
          min_notice_hours?: number
          professional_id: string
          slug: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          accepting?: boolean
          created_at?: string
          horizon_days?: number
          id?: string
          intro?: string | null
          min_notice_hours?: number
          professional_id?: string
          slug?: string
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendars_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          bs_per_usd: number
          created_at: string
          fecha_valor: string | null
          fetched_at: string | null
          official_bs_per_usd: number | null
          rate_date: string
          source: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bs_per_usd: number
          created_at?: string
          fecha_valor?: string | null
          fetched_at?: string | null
          official_bs_per_usd?: number | null
          rate_date: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bs_per_usd?: number
          created_at?: string
          fecha_valor?: string | null
          fetched_at?: string | null
          official_bs_per_usd?: number | null
          rate_date?: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_report_deliveries: {
        Row: {
          automatic: boolean
          channel: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          error: string | null
          error_code: string | null
          failed_at: string | null
          id: string
          read_at: string | null
          report_id: string
          revision: number
          status: string
          to_phone: string | null
          wamid: string | null
        }
        Insert: {
          automatic?: boolean
          channel: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error?: string | null
          error_code?: string | null
          failed_at?: string | null
          id?: string
          read_at?: string | null
          report_id: string
          revision?: number
          status?: string
          to_phone?: string | null
          wamid?: string | null
        }
        Update: {
          automatic?: boolean
          channel?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error?: string | null
          error_code?: string | null
          failed_at?: string | null
          id?: string
          read_at?: string | null
          report_id?: string
          revision?: number
          status?: string
          to_phone?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_report_deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_report_deliveries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "lab_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_report_versions: {
        Row: {
          finalized_at: string
          finalized_by: string | null
          notes: string | null
          patient_snapshot: Json
          patient_type: string
          report_id: string
          requested_by: string | null
          revision: number
          sampled_at: string
          sections: Json
          signer: Json
        }
        Insert: {
          finalized_at: string
          finalized_by?: string | null
          notes?: string | null
          patient_snapshot: Json
          patient_type: string
          report_id: string
          requested_by?: string | null
          revision: number
          sampled_at: string
          sections: Json
          signer: Json
        }
        Update: {
          finalized_at?: string
          finalized_by?: string | null
          notes?: string | null
          patient_snapshot?: Json
          patient_type?: string
          report_id?: string
          requested_by?: string | null
          revision?: number
          sampled_at?: string
          sections?: Json
          signer?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lab_report_versions_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_report_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "lab_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_reports: {
        Row: {
          appointment_id: string | null
          created_at: string
          created_by: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          notes: string | null
          number: number
          patient_id: string
          patient_snapshot: Json | null
          patient_type: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          requested_by: string | null
          revision: number
          sampled_at: string
          sections: Json
          signer: Json | null
          status: Database["public"]["Enums"]["lab_report_status"]
          summary: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          notes?: string | null
          number?: never
          patient_id: string
          patient_snapshot?: Json | null
          patient_type?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          requested_by?: string | null
          revision?: number
          sampled_at?: string
          sections?: Json
          signer?: Json | null
          status?: Database["public"]["Enums"]["lab_report_status"]
          summary?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          notes?: string | null
          number?: never
          patient_id?: string
          patient_snapshot?: Json | null
          patient_type?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          requested_by?: string | null
          revision?: number
          sampled_at?: string
          sections?: Json
          signer?: Json | null
          status?: Database["public"]["Enums"]["lab_report_status"]
          summary?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_reports_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_balances"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "lab_reports_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_settings: {
        Row: {
          id: boolean
          signer_college: string | null
          signer_id_number: string | null
          signer_name: string
          signer_registry: string | null
          signer_signature: string | null
          signer_title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          signer_college?: string | null
          signer_id_number?: string | null
          signer_name: string
          signer_registry?: string | null
          signer_signature?: string | null
          signer_title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          signer_college?: string | null
          signer_id_number?: string | null
          signer_name?: string
          signer_registry?: string | null
          signer_signature?: string | null
          signer_title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          id_number: string | null
          id_type: string | null
          last_name: string
          notes: string | null
          phone: string | null
          phone_e164: string | null
          sex: string | null
          source: string
          updated_at: string
          whatsapp_consent: boolean | null
          whatsapp_consent_at: string | null
          whatsapp_user_id: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          last_name: string
          notes?: string | null
          phone?: string | null
          phone_e164?: string | null
          sex?: string | null
          source?: string
          updated_at?: string
          whatsapp_consent?: boolean | null
          whatsapp_consent_at?: string | null
          whatsapp_user_id?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          phone_e164?: string | null
          sex?: string | null
          source?: string
          updated_at?: string
          whatsapp_consent?: boolean | null
          whatsapp_consent_at?: string | null
          whatsapp_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_bs: number
          amount_usd: number
          appointment_id: string
          cashea_order: string | null
          created_at: string
          currency: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_on: string
          rate: number
          received_by: string | null
          reference: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_bs: number
          amount_usd: number
          appointment_id: string
          cashea_order?: string | null
          created_at?: string
          currency: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_on?: string
          rate: number
          received_by?: string | null
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_bs?: number
          amount_usd?: number
          appointment_id?: string
          cashea_order?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_on?: string
          rate?: number
          received_by?: string | null
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_balances"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_paid_on_fkey"
            columns: ["paid_on"]
            isOneToOne: false
            referencedRelation: "exchange_rates"
            referencedColumns: ["rate_date"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          area: Database["public"]["Enums"]["service_area"]
          created_at: string
          id: string
          name: string
          price_usd: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          area: Database["public"]["Enums"]["service_area"]
          created_at?: string
          id?: string
          name: string
          price_usd: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          area?: Database["public"]["Enums"]["service_area"]
          created_at?: string
          id?: string
          name?: string
          price_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_doctor_alerts: {
        Row: {
          appointment_id: string
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          error: string | null
          error_code: string | null
          failed_at: string | null
          id: string
          professional_id: string
          read_at: string | null
          sent_at: string | null
          starts_at: string
          status: string
          template_language: string | null
          template_name: string | null
          to_phone: string
          wamid: string | null
        }
        Insert: {
          appointment_id: string
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          error_code?: string | null
          failed_at?: string | null
          id?: string
          professional_id: string
          read_at?: string | null
          sent_at?: string | null
          starts_at: string
          status?: string
          template_language?: string | null
          template_name?: string | null
          to_phone: string
          wamid?: string | null
        }
        Update: {
          appointment_id?: string
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          error_code?: string | null
          failed_at?: string | null
          id?: string
          professional_id?: string
          read_at?: string | null
          sent_at?: string | null
          starts_at?: string
          status?: string
          template_language?: string | null
          template_name?: string | null
          to_phone?: string
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_doctor_alerts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_balances"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "whatsapp_doctor_alerts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_doctor_alerts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_doctor_phones: {
        Row: {
          created_at: string
          phone: string
          professional_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          phone: string
          professional_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          phone?: string
          professional_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_doctor_phones_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_doctor_phones_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          appointment_id: string
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          error: string | null
          error_code: string | null
          failed_at: string | null
          id: string
          kind: string
          patient_id: string
          read_at: string | null
          replied_at: string | null
          reply: string | null
          reply_effect: string | null
          sent_at: string | null
          starts_at: string
          status: string
          template_language: string | null
          template_name: string | null
          to_phone: string
          wamid: string | null
        }
        Insert: {
          appointment_id: string
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          error_code?: string | null
          failed_at?: string | null
          id?: string
          kind: string
          patient_id: string
          read_at?: string | null
          replied_at?: string | null
          reply?: string | null
          reply_effect?: string | null
          sent_at?: string | null
          starts_at: string
          status?: string
          template_language?: string | null
          template_name?: string | null
          to_phone: string
          wamid?: string | null
        }
        Update: {
          appointment_id?: string
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          error_code?: string | null
          failed_at?: string | null
          id?: string
          kind?: string
          patient_id?: string
          read_at?: string | null
          replied_at?: string | null
          reply?: string | null
          reply_effect?: string | null
          sent_at?: string | null
          starts_at?: string
          status?: string
          template_language?: string | null
          template_name?: string | null
          to_phone?: string
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_balances"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          connected: boolean
          connected_at: string | null
          connected_by: string | null
          disconnect_reason: string | null
          disconnected_at: string | null
          id: boolean
          phone: string | null
          send_confirmations: boolean
          send_doctor_alerts: boolean
          send_lab_results: boolean
          send_reminders: boolean
          updated_at: string
          zernio_account_id: string | null
        }
        Insert: {
          connected?: boolean
          connected_at?: string | null
          connected_by?: string | null
          disconnect_reason?: string | null
          disconnected_at?: string | null
          id?: boolean
          phone?: string | null
          send_confirmations?: boolean
          send_doctor_alerts?: boolean
          send_lab_results?: boolean
          send_reminders?: boolean
          updated_at?: string
          zernio_account_id?: string | null
        }
        Update: {
          connected?: boolean
          connected_at?: string | null
          connected_by?: string | null
          disconnect_reason?: string | null
          disconnected_at?: string | null
          id?: boolean
          phone?: string | null
          send_confirmations?: boolean
          send_doctor_alerts?: boolean
          send_lab_results?: boolean
          send_reminders?: boolean
          updated_at?: string
          zernio_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          language: string
          meta_template_id: string | null
          name: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          language: string
          meta_template_id?: string | null
          name: string
          reason?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          language?: string
          meta_template_id?: string | null
          name?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_webhook_events: {
        Row: {
          event: string
          id: string
          received_at: string
        }
        Insert: {
          event: string
          id: string
          received_at?: string
        }
        Update: {
          event?: string
          id?: string
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      appointment_balances: {
        Row: {
          appointment_id: string | null
          balance_usd: number | null
          paid_usd: number | null
          patient_id: string | null
          starts_at: string | null
          starts_on: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          total_usd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      book_online: {
        Args: {
          calendar: string
          client?: string
          document_number: string
          document_type: string
          email?: string
          first_name?: string
          last_name?: string
          local_day: string
          local_time: string
          notes?: string
          phone?: string
          service: string
        }
        Returns: Json
      }
      booking_calendar: { Args: { calendar_slug: string }; Returns: Json }
      booking_directory: { Args: never; Returns: Json }
      calendar_check_ranges: { Args: { ranges: Json }; Returns: undefined }
      calendar_free_slots: {
        Args: {
          calendar: string
          from_day: string
          service: string
          to_day: string
        }
        Returns: {
          day: string
          starts: string
        }[]
      }
      calendar_professionals: {
        Args: never
        Returns: {
          avatar_url: string
          calendar_id: string
          full_name: string
          professional_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      calendar_windows: {
        Args: { calendar: string; from_day: string; to_day: string }
        Returns: {
          day: string
          ends: string
          special: boolean
          starts: string
        }[]
      }
      can_build_lab_reports: { Args: never; Returns: boolean }
      can_collect_payments: { Args: never; Returns: boolean }
      can_manage_accounting: { Args: never; Returns: boolean }
      can_manage_calendars: { Args: never; Returns: boolean }
      can_manage_schedule: { Args: never; Returns: boolean }
      can_see_calendar: { Args: { calendar: string }; Returns: boolean }
      clinic_professionals: {
        Args: never
        Returns: {
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      clinic_today: { Args: never; Returns: string }
      create_appointment: {
        Args: {
          duration_minutes: number
          items: Json
          local_date: string
          local_time: string
          notes: string
          patient: string
        }
        Returns: string
      }
      create_calendar: {
        Args: {
          link_name: string
          offered: Json
          professional: string
          specialty_label: string
        }
        Returns: string
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      delete_calendar_special_day: {
        Args: { calendar: string; special_day: string }
        Returns: undefined
      }
      finalize_lab_report: { Args: { report: string }; Returns: string }
      is_member: { Args: never; Returns: boolean }
      is_my_appointment: { Args: { appointment: string }; Returns: boolean }
      is_my_patient: { Args: { patient: string }; Returns: boolean }
      normalize_phone: { Args: { raw: string }; Returns: string }
      payment_method_currency: {
        Args: { method: Database["public"]["Enums"]["payment_method"] }
        Returns: string
      }
      record_cashea_payment: {
        Args: {
          appointment: string
          initial_amount?: number
          initial_method?: Database["public"]["Enums"]["payment_method"]
          initial_reference?: string
          order_number: string
          order_total_usd: number
        }
        Returns: undefined
      }
      record_official_rate: {
        Args: {
          bs_per_usd: number
          rate_day: string
          rate_source: string
          valid_since: string
        }
        Returns: string
      }
      reopen_lab_report: {
        Args: { reason: string; report: string }
        Returns: undefined
      }
      reschedule_appointment: {
        Args: {
          appointment: string
          duration_minutes: number
          local_date: string
          local_time: string
        }
        Returns: undefined
      }
      save_calendar_hours: {
        Args: { calendar: string; hours: Json }
        Returns: undefined
      }
      save_calendar_services: {
        Args: { calendar: string; offered: Json }
        Returns: undefined
      }
      save_calendar_special_day: {
        Args: {
          calendar: string
          ranges: Json
          reason: string
          special_day: string
        }
        Returns: undefined
      }
      search_patients: {
        Args: { max_rows?: number; query?: string }
        Returns: {
          address: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          id_number: string | null
          id_type: string | null
          last_name: string
          notes: string | null
          phone: string | null
          phone_e164: string | null
          sex: string | null
          source: string
          updated_at: string
          whatsapp_consent: boolean | null
          whatsapp_consent_at: string | null
          whatsapp_user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "patients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      sees_all_schedule: { Args: never; Returns: boolean }
      sees_patient: { Args: { patient: string }; Returns: boolean }
      set_exchange_rate: {
        Args: { bs_per_usd: number; rate_day: string }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          member_id: string
          new_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      void_payment: {
        Args: { payment: string; reason: string }
        Returns: undefined
      }
      whatsapp_apply_reply: {
        Args: { answer: string; message_id: string; user_id?: string }
        Returns: Json
      }
      whatsapp_connected: { Args: never; Returns: boolean }
      whatsapp_doctor_alert_outbox: {
        Args: { alerts: string[] }
        Returns: {
          first_name: string
          id: string
          last_name: string
          on_visit: boolean
          phone: string
          professional_id: string
          services: string
          status: string
          visit_starts_at: string
          visit_status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      whatsapp_outbox: {
        Args: { messages: string[] }
        Returns: {
          area: Database["public"]["Enums"]["service_area"]
          consent: boolean
          first_name: string
          id: string
          kind: string
          professional: string
          starts_at: string
          status: string
          to_phone: string
          visit_starts_at: string
          visit_status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      whatsapp_queue_confirmation: {
        Args: { appointment: string }
        Returns: string
      }
      whatsapp_queue_online_booking: {
        Args: {
          document_number: string
          document_type: string
          local_day: string
          local_time: string
          opt_in: boolean
        }
        Returns: string
      }
      whatsapp_queue_reminders: { Args: { for_day: string }; Returns: string[] }
      whatsapp_reachable: { Args: { phone: string }; Returns: boolean }
      whatsapp_record_status: {
        Args: {
          code?: string
          detail?: string
          new_status: string
          ref: string
          status_at: string
        }
        Returns: string
      }
      whatsapp_reply_target: {
        Args: { conversation: string; phone: string; quoted?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "doctor" | "director" | "staff" | "admin"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "cancelled"
        | "no_show"
      lab_report_status: "draft" | "final"
      payment_method:
        | "cash_usd"
        | "zelle"
        | "pago_movil"
        | "card_bs"
        | "transfer_bs"
        | "cash_bs"
        | "cashea"
      service_area: "medicina" | "odontologia" | "bioanalisis"
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
      app_role: ["doctor", "director", "staff", "admin"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "no_show",
      ],
      lab_report_status: ["draft", "final"],
      payment_method: [
        "cash_usd",
        "zelle",
        "pago_movil",
        "card_bs",
        "transfer_bs",
        "cash_bs",
        "cashea",
      ],
      service_area: ["medicina", "odontologia", "bioanalisis"],
    },
  },
} as const
