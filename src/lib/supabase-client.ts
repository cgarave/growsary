import { createClient } from "@supabase/supabase-js";

/**
 * ==============================================================================
 * SUPABASE CLIENT-SIDE WEBSOCKETS SETUP FOR REALTIME SYNC
 * ==============================================================================
 * 
 * This module creates a browser-side Supabase client initialized with:
 * 1. NEXT_PUBLIC_SUPABASE_URL: The Supabase project API endpoint.
 * 2. NEXT_PUBLIC_SUPABASE_ANON_KEY: The public anonymous API key.
 * 
 * WHY WE USE THIS FOR REALTIME:
 * Unlike standard HTTP REST queries that require continuous polling (which can waste CPU/RAM),
 * the Supabase client opens a persistent, lightweight WebSocket connection to Supabase Realtime.
 * 
 * When a row in PostgreSQL changes (INSERT, UPDATE, or DELETE), Supabase pushes a tiny
 * payload directly over the open WebSocket to all connected devices in ~50ms.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uguqcreqtnrbiodwhhhi.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
