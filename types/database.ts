export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            scores: {
                Row: {
                    id: string
                    created_at: string
                    user_id: string
                    score: number
                    username: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    user_id: string
                    score: number
                    username?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    user_id?: string
                    score?: number
                    username?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "scores_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            profiles: {
                Row: {
                    id: string
                    username: string | null
                    updated_at: string | null
                }
                Insert: {
                    id: string
                    username?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    username?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_id_fkey"
                        columns: ["id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
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
