import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { Database } from './types';

const SUPABASE_URL = "https://umqehhhpedwqdfjmdjqv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcWVoaGhwZWR3cWRmam1kanF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NTM0NDYsImV4cCI6MjA4NTAyOTQ0Nn0.VWsUvdzOIhLLDKYzCvGcqgJ39aGpHvSzNRJd3zIiZHE";

const CapacitorStorage = {
  getItem: async (key: string) => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key });
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: Capacitor.isNativePlatform() ? CapacitorStorage : localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !Capacitor.isNativePlatform(),
  }
});
