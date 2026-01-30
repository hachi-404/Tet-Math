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
            }
        }
    }
}
