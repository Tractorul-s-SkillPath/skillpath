import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface UserProfile {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'student' | 'admin';
  status: 'active' | 'inactive';
}

export interface DashboardStats {
  totalUsers: number;
  totalAssessments: number;
  averageScore: number;
}

export async function getUsersListRepo(
  searchQuery?: string,
  roleFilter?: string,
  statusFilter?: string
): Promise<UserProfile[]> {
  let query = supabaseAdmin
    .from('users')
    .select('user_id, first_name, last_name, email, role, status')
    .order('user_id', { ascending: false });

  if (roleFilter) query = query.eq('role', roleFilter);
  if (statusFilter) query = query.eq('status', statusFilter);
  if (searchQuery) {
    query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error('Failed to retrieve the users list.');

  return data as UserProfile[];
}

export async function getDashboardStatsRepo(): Promise<DashboardStats> {
  const { count: usersCount } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true });
  const { count: assessmentsCount } = await supabaseAdmin.from('assessment').select('*', { count: 'exact', head: true });
  const { data: assessments } = await supabaseAdmin.from('assessment').select('total_score').not('total_score', 'is', null);

  let avgScore = 0;
  if (assessments && assessments.length > 0) {
    const total = assessments.reduce((acc, curr) => acc + Number(curr.total_score), 0);
    avgScore = total / assessments.length;
  }

  return {
    totalUsers: usersCount || 0,
    totalAssessments: assessmentsCount || 0,
    averageScore: Number(avgScore.toFixed(1))
  };
}

export async function updateUserStatusRepo(userId: number, newStatus: 'active' | 'inactive'): Promise<void> {
  const { error } = await supabaseAdmin.from('users').update({ status: newStatus }).eq('user_id', userId);
  if (error) throw new Error('Failed to update user status.');
}

export interface CategoryStat {
  category_id: number;
  category_name: string;
  assessments_count: number;
  average_score: number;
}

export async function getWeakCategoriesRepo(): Promise<CategoryStat[]> {
  const { data, error } = await supabaseAdmin
    .from('weak_categories_summary')
    .select('*')
    .order('average_score', { ascending: true });

  if (error) {
    console.error('Error fetching weak categories:', error);
    return [];
  }
  return data as CategoryStat[];
}

export interface AssessmentResult {
  assessment_id: number;
  first_name: string;
  last_name: string;
  email: string;
  category_name: string;
  total_score: number;
  level: string;
  created_at: string;
}

export async function getResultsListRepo(
  page: number = 1,
  search?: string,
  category?: string,
  sortBy: string = 'date_desc'
): Promise<{ data: AssessmentResult[], total: number }> {
  const limit = 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from('admin_results_view')
    .select('*', { count: 'exact' });

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (category) {
    query = query.ilike('category_name', `%${category}%`);
  }

  if (sortBy === 'score_desc') query = query.order('total_score', { ascending: false });
  else if (sortBy === 'score_asc') query = query.order('total_score', { ascending: true });
  else if (sortBy === 'date_asc') query = query.order('created_at', { ascending: true });
  else query = query.order('created_at', { ascending: false }); // Default: newest first

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error('Error fetching results:', error);
    throw new Error('Failed to retrieve the results list.');
  }

  return { data: data as AssessmentResult[], total: count || 0 };
}

export async function getCategoriesDropdownRepo(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('skill_category').select('name').order('name');
  if (error) return [];
  return data.map(d => d.name);
}

export interface CategoryData {
  category_id: number;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  question_count: number;
}

export async function getCategoriesListRepo(): Promise<CategoryData[]> {
  const { data, error } = await supabaseAdmin
    .from('skill_category')
    .select(`
      category_id,
      name,
      description,
      status,
      question (count)
    `)
    .order('name');

  if (error) throw new Error('Failed to fetch categories.');

  return data.map((cat: any) => ({
    category_id: cat.category_id,
    name: cat.name,
    description: cat.description,
    status: cat.status,
    question_count: cat.question[0]?.count || 0
  }));
}

export async function createCategoryRepo(name: string, description: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('skill_category')
    .insert([{ name, description }]);

  if (error) {
    if (error.code === '23505') throw new Error('A category with this name already exists.');
    throw new Error('Failed to create category.');
  }
}

export async function toggleCategoryStatusRepo(categoryId: number, newStatus: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('skill_category')
    .update({ status: newStatus })
    .eq('category_id', categoryId);

  if (error) throw new Error('Failed to update category status.');
}

export interface QuestionOption {
  answer_id?: number;
  answer_text: string;
  is_correct: boolean;
}

export interface QuestionData {
  question_id: number;
  category_id: number;
  text: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  status: 'active' | 'inactive';
  options: QuestionOption[];
}

export async function getQuestionsByCategoryRepo(categoryId: number): Promise<QuestionData[]> {
  const { data, error } = await supabaseAdmin
    .from('question')
    .select(`
      question_id,
      category_id,
      text,
      difficulty,
      status,
      answer (
        answer_id,
        answer_text,
        is_correct
      )
    `)
    .eq('category_id', categoryId)
    .order('question_id', { ascending: false });

  if (error) {
    console.error('SUPABASE ERROR fetching questions:', error);
    throw new Error('Failed to fetch questions.');
  }

  return data.map((q: any) => ({
    question_id: q.question_id,
    category_id: q.category_id,
    text: q.text,
    difficulty: q.difficulty,
    status: q.status,
    options: q.answer || []
  }));
}

export async function getCategoryByIdRepo(categoryId: number) {
  const { data, error } = await supabaseAdmin.from('skill_category').select('name').eq('category_id', categoryId).single();
  if (error) throw new Error('Category not found');
  return data;
}

export async function createQuestionRepo(
  categoryId: number,
  text: string,
  difficulty: string,
  options: any[]
): Promise<void> {
  const { data: questionData, error: questionError } = await supabaseAdmin
    .from('question')
    .insert([{ category_id: categoryId, text, difficulty, status: 'active' }])
    .select('question_id')
    .single();

  if (questionError || !questionData) {
    console.error('Insert Question Error:', questionError);
    throw new Error('Failed to insert question.');
  }

  const answersToInsert = options.map(opt => ({
    question_id: questionData.question_id,
    answer_text: opt.text, // mapăm 'text' din UI la 'answer_text' în DB
    is_correct: opt.is_correct
  }));

  const { error: optionsError } = await supabaseAdmin
    .from('answer')
    .insert(answersToInsert);

  if (optionsError) {
    console.error('Insert Answers Error:', optionsError);
    throw new Error('Failed to insert answers.');
  }
}