-- 1. Activarea securității RLS pe toate tabelele
alter table public.users enable row level security;
alter table public.skill_categories enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.assessments enable row level security;
alter table public.student_responses enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.category_progress enable row level security;
alter table public.recommendation_plans enable row level security;
alter table public.xp_events enable row level security;

-- 2. Conținut educațional (Orice utilizator logat poate citi, nimeni nu poate scrie)
create policy "Vizualizare categorii" on public.skill_categories for select using (true);
create policy "Vizualizare intrebari" on public.questions for select using (true);
create policy "Vizualizare raspunsuri" on public.answers for select using (true);

-- 3. Date personale (Studenții pot citi/scrie STRICT propriile date)
create policy "Acces profil propriu" on public.users for all using (user_id = auth.uid());
create policy "Acces evaluari proprii" on public.assessments for all using (user_id = auth.uid());
create policy "Acces progres propriu" on public.category_progress for all using (user_id = auth.uid());
create policy "Acces planuri recomandate" on public.recommendation_plans for all using (user_id = auth.uid());
create policy "Acces istoric XP" on public.xp_events for all using (user_id = auth.uid());

-- 4. Date relaționale (Verificarea se face prin tabela părinte 'assessments')
create policy "Acces raspunsuri student" on public.student_responses for all using (
    assessment_id in (select assessment_id from public.assessments where user_id = auth.uid())
);
create policy "Acces intrebari evaluare" on public.assessment_questions for all using (
    assessment_id in (select assessment_id from public.assessments where user_id = auth.uid())
);