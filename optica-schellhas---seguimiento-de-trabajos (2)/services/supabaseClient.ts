import { createClient } from '@supabase/supabase-js';

// -------------------------------------------------------------------
// ¡IMPORTANTE!
// Reemplaza los siguientes valores con tu propia URL y clave anónima
// de tu proyecto de Supabase. Puedes encontrarlas en:
// "Project Settings" > "API" en tu dashboard de Supabase.
// -------------------------------------------------------------------
const supabaseUrl = 'https://edtihpamughufndzhzeh.supabase.co'; // Pega tu URL aquí
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkdGlocGFtdWdodWZuZHpoemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NDA4MDYsImV4cCI6MjA3MjQxNjgwNn0.IoC4UP4xDCCU1dv3pSISFx45m2cNSe63fyiy-GFj96U'; // Pega tu clave anónima aquí

// FIX: Removed the check for placeholder Supabase credentials. This check caused a TypeScript
// error once the credentials were provided, as the compiler knew the comparison would always be false.


export const supabase = createClient(supabaseUrl, supabaseAnonKey);