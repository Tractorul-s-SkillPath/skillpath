import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface StudentProfile {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export async function getStudentsListRepo(): Promise<StudentProfile[]> {
  // We query the 'users' table and only fetch existing columns
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('user_id, first_name, last_name, email, status')
    .eq('role', 'student');

  if (error) {
    console.error('Database fetch error:', error);
    throw new Error('Failed to retrieve the students list from the database.');
  }

  // Since 'created_at' does not exist in the 'users' table,
  // we add a fallback date so the UI table doesn't crash.
  const mappedData = data.map(user => ({
    ...user,
    created_at: new Date().toISOString()
  }));

  return mappedData as StudentProfile[];
}