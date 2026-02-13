import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

export const createSupabaseClient = (supabaseUrl?: string, supabaseKey?: string): SupabaseClient<Database> => {
    const env = (import.meta as any).env;
    const url = supabaseUrl || env?.VITE_SUPABASE_URL;
    const key = supabaseKey || env?.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error("Supabase URL and Key are required to create a client.");
    }
    return createClient<Database>(url, key);
};