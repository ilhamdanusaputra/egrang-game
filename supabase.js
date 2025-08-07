import { createClient } from '@supabase/supabase-js'
// Create a single supabase client for interacting with your database

supabaseUrl = "https://hiezdkhaagcbeyhmclqq.supabase.co"
supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpZXpka2hhYWdjYmV5aG1jbHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1Nzc3ODcsImV4cCI6MjA3MDE1Mzc4N30.hVnk8rM7FupJDvyHlsHxeHCiB6cIWRWJ1oGlM7RlA3E"
export const supabase = createClient(supabaseUrl, supabaseKey);

export async function createProfile(name) {
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ name }]);

  return { data, error };
}
