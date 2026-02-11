// AUTO-GENERATED — regenerate after migrations with:
//   supabase gen types typescript --local > src/types/database.types.ts
//
// This is a placeholder until TASK-002 applies the DB migrations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
