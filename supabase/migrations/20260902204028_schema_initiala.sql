drop schema public cascade;
create schema public;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create extension if not exists citext;

create type public.user_role as enum ('student', 'admin');
create type public.user_status as enum ('active', 'inactive');
create type public.skill_level as enum ('beginner', 'intermediate', 'advanced');
create type public.content_status as enum ('active', 'inactive');
create type public.assessment_status as enum ('in_progress', 'submitted', 'abandoned');
create type public.plan_status as enum ('not_started', 'in_progress', 'completed');
create type public.question_source as enum ('manual', 'ai');
create type public.xp_reason as enum (
    'assessment_submitted',
    'assessment_score',
    'plan_item_completed',
    'badge_earned',
    'quest_completed'
);

create table public.users (
    user_id uuid primary key references auth.users (id) on delete cascade,
    first_name text not null default '' check (char_length(first_name) <= 60),
    last_name text not null default '' check (char_length(last_name) <= 60),
    email citext not null unique check (char_length(email) between 3 and 320),
    role public.user_role not null default 'student',
    status public.user_status not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index users_role_status_idx on public.users (role, status);

create table public.skill_categories (
    category_id bigint generated always as identity primary key,
    name text not null unique check (char_length(trim(name)) between 2 and 60),
    description text not null default '',
    status public.content_status not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index skill_categories_status_idx on public.skill_categories (status);

create table public.questions (
    question_id bigint generated always as identity primary key,
    category_id bigint not null references public.skill_categories (category_id) on delete restrict,
    text text not null check (char_length(trim(text)) between 5 and 1000),
    difficulty public.skill_level not null,
    status public.content_status not null default 'active',
    source public.question_source not null default 'manual',
    created_by uuid references public.users (user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index questions_pick_idx on public.questions (category_id, status, difficulty);

create table public.answers (
    answer_id bigint generated always as identity primary key,
    question_id bigint not null references public.questions (question_id) on delete cascade,
    answer_text text not null check (char_length(trim(answer_text)) between 1 and 500),
    is_correct boolean not null default false,
    position smallint not null default 0 check (position >= 0)
);
create index answers_question_idx on public.answers (question_id, position);
create unique index answers_position_unique on public.answers (question_id, position);

create table public.assessments (
    assessment_id bigint generated always as identity primary key,
    user_id uuid not null references public.users (user_id) on delete cascade,
    category_id bigint not null references public.skill_categories (category_id) on delete restrict,
    session_id uuid,
    requested_level public.skill_level not null,
    status public.assessment_status not null default 'in_progress',
    total_score numeric(5, 2) check (total_score between 0 and 100),
    time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds between 30 and 7200),
    created_at timestamptz not null default now(),
    started_at timestamptz,
    submitted_at timestamptz,
    constraint assessments_score_present check ((status = 'submitted') = (total_score is not null)),
    constraint assessments_submitted_at_present check ((status = 'submitted') = (submitted_at is not null))
);
create index assessments_user_recent_idx on public.assessments (user_id, created_at desc);
create index assessments_category_idx on public.assessments (category_id, status);
create index assessments_session_idx on public.assessments (session_id) where session_id is not null;
create unique index one_active_assessment_per_user_category on public.assessments (user_id, category_id) where status = 'in_progress';

create table public.student_responses (
    student_response_id bigint generated always as identity primary key,
    assessment_id bigint not null references public.assessments (assessment_id) on delete cascade,
    question_id bigint not null references public.questions (question_id) on delete restrict,
    selected_answer_id bigint references public.answers (answer_id) on delete restrict,
    position smallint not null check (position >= 0),
    is_correct boolean,
    answered_at timestamptz,
    constraint student_responses_question_unique unique (assessment_id, question_id),
    constraint student_responses_position_unique unique (assessment_id, position),
    constraint student_responses_answered_at_present check ((selected_answer_id is null) = (answered_at is null))
);
create index student_responses_assessment_idx on public.student_responses (assessment_id, position);

create table public.assessment_questions (
    assessment_id bigint not null references public.assessments (assessment_id) on delete cascade,
    question_id bigint not null references public.questions (question_id) on delete restrict,
    position smallint not null check (position >= 0),
    primary key (assessment_id, question_id),
    constraint assessment_questions_position_unique unique (assessment_id, position)
);

create table public.category_progress (
    progress_id bigint generated always as identity primary key,
    user_id uuid not null references public.users (user_id) on delete cascade,
    category_id bigint not null references public.skill_categories (category_id) on delete cascade,
    current_level public.skill_level not null default 'beginner',
    last_score numeric(5, 2) check (last_score between 0 and 100),
    last_assessed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint category_progress_unique unique (user_id, category_id)
);
create index category_progress_user_idx on public.category_progress (user_id);

create table public.recommendation_plans (
    recommendation_id bigint generated always as identity primary key,
    user_id uuid not null references public.users (user_id) on delete cascade,
    category_id bigint not null references public.skill_categories (category_id) on delete cascade,
    assessment_id bigint references public.assessments (assessment_id) on delete set null,
    topic_title text not null check (char_length(trim(topic_title)) between 2 and 200),
    rule_description text not null default '',
    ai_description text,
    priority smallint not null default 3 check (priority between 1 and 5),
    progress_status public.plan_status not null default 'not_started',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint recommendation_plans_topic_unique unique (user_id, category_id, topic_title),
    constraint recommendation_plans_completed_at_present check ((progress_status = 'completed') = (completed_at is not null))
);
create index recommendation_plans_user_idx on public.recommendation_plans (user_id, category_id, priority);

create table public.xp_events (
    xp_event_id bigint generated always as identity primary key,
    user_id uuid not null references public.users (user_id) on delete cascade,
    amount integer not null check (amount <> 0),
    reason public.xp_reason not null,
    assessment_id bigint references public.assessments (assessment_id) on delete cascade,
    recommendation_id bigint references public.recommendation_plans (recommendation_id) on delete cascade,
    code text check (code is null or char_length(code) between 2 and 60),
    awarded_on date not null default (now() at time zone 'Europe/Bucharest')::date,
    awarded_at timestamptz not null default now(),
    constraint xp_events_provenance check (
        case reason
            when 'assessment_submitted' then assessment_id is not null and recommendation_id is null and code is null
            when 'assessment_score' then assessment_id is not null and recommendation_id is null and code is null
            when 'plan_item_completed' then recommendation_id is not null and assessment_id is null and code is null
            when 'badge_earned' then code is not null and assessment_id is null and recommendation_id is null
            when 'quest_completed' then code is not null and assessment_id is null and recommendation_id is null
        end
    )
);
create index xp_events_user_idx on public.xp_events (user_id, awarded_at desc);
create index xp_events_user_day_idx on public.xp_events (user_id, awarded_on);
create unique index xp_events_assessment_once on public.xp_events (user_id, reason, assessment_id) where assessment_id is not null;
create unique index xp_events_plan_item_once on public.xp_events (user_id, recommendation_id) where recommendation_id is not null;
create unique index xp_events_badge_once on public.xp_events (user_id, code) where reason = 'badge_earned';
create unique index xp_events_quest_once_per_day on public.xp_events (user_id, code, awarded_on) where reason = 'quest_completed';

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger skill_categories_updated_at before update on public.skill_categories for each row execute function public.set_updated_at();
create trigger questions_updated_at before update on public.questions for each row execute function public.set_updated_at();
create trigger category_progress_updated_at before update on public.category_progress for each row execute function public.set_updated_at();
create trigger recommendation_plans_updated_at before update on public.recommendation_plans for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (user_id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    'student'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.xp_per_assessment() returns integer language sql immutable as $$ select 50 $$;
create or replace function public.xp_per_score_point() returns integer language sql immutable as $$ select 1 $$;
create or replace function public.xp_per_plan_item() returns integer language sql immutable as $$ select 40 $$;

create or replace function public.level_for_score(p_score numeric)
returns public.skill_level language sql immutable as $$
    select case
        when p_score is null then 'beginner'::public.skill_level
        when p_score >= 80 then 'advanced'::public.skill_level
        when p_score >= 50 then 'intermediate'::public.skill_level
        else 'beginner'::public.skill_level
    end;
$$;

create or replace function public.grade_assessment(p_assessment_id bigint)
returns numeric language plpgsql security definer set search_path = public as $$
declare
    v_status public.assessment_status;
    v_total integer;
    v_correct integer;
    v_score numeric(5, 2);
begin
    select status into v_status from public.assessments where assessment_id = p_assessment_id for update;
    if v_status is null then
        raise exception 'assessment % does not exist', p_assessment_id using errcode = 'no_data_found';
    end if;
    if v_status <> 'in_progress' then
        raise exception 'assessment % is already %', p_assessment_id, v_status using errcode = 'invalid_parameter_value';
    end if;

    update public.student_responses r
       set is_correct = a.is_correct
      from public.answers a
     where r.assessment_id = p_assessment_id
       and r.selected_answer_id = a.answer_id;

    update public.student_responses
       set is_correct = false
     where assessment_id = p_assessment_id
       and selected_answer_id is null;

    select count(*), count(*) filter (where is_correct)
      into v_total, v_correct
      from public.student_responses
     where assessment_id = p_assessment_id;

    v_score := case when v_total = 0 then 0 else round((v_correct::numeric * 100) / v_total, 2) end;

    update public.assessments
       set status = 'submitted', total_score = v_score, submitted_at = now()
     where assessment_id = p_assessment_id;

    return v_score;
end;
$$;

create or replace function public.on_assessment_submitted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.status <> 'submitted' or old.status is not distinct from 'submitted' then
        return new;
    end if;

    insert into public.xp_events (user_id, amount, reason, assessment_id)
    values (new.user_id, public.xp_per_assessment(), 'assessment_submitted', new.assessment_id)
    on conflict do nothing;

    if round(coalesce(new.total_score, 0)) > 0 then
        insert into public.xp_events (user_id, amount, reason, assessment_id)
        values (new.user_id, round(new.total_score)::integer * public.xp_per_score_point(), 'assessment_score', new.assessment_id)
        on conflict do nothing;
    end if;

    insert into public.category_progress (user_id, category_id, current_level, last_score, last_assessed_at)
    values (new.user_id, new.category_id, public.level_for_score(new.total_score), new.total_score, new.submitted_at)
    on conflict (user_id, category_id) do update
        set current_level = excluded.current_level,
            last_score = excluded.last_score,
            last_assessed_at = excluded.last_assessed_at,
            updated_at = now();

    return new;
end;
$$;

create trigger assessments_award_xp after update on public.assessments for each row execute function public.on_assessment_submitted();

create or replace function public.sync_plan_completed_at()
returns trigger language plpgsql as $$
begin
    if new.progress_status = 'completed' and new.completed_at is null then
        new.completed_at := now();
    elsif new.progress_status <> 'completed' then
        new.completed_at := null;
    end if;
    return new;
end;
$$;

create trigger recommendation_plans_completed_at before insert or update on public.recommendation_plans for each row execute function public.sync_plan_completed_at();

create or replace function public.on_plan_item_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.progress_status <> 'completed' or old.progress_status is not distinct from 'completed' then
        return new;
    end if;

    insert into public.xp_events (user_id, amount, reason, recommendation_id)
    values (new.user_id, public.xp_per_plan_item(), 'plan_item_completed', new.recommendation_id)
    on conflict do nothing;

    return new;
end;
$$;

create trigger recommendation_plans_award_xp after update on public.recommendation_plans for each row execute function public.on_plan_item_completed();

create or replace view public.user_xp_totals as
    select u.user_id, coalesce(sum(x.amount), 0)::integer as total_xp
      from public.users u
      left join public.xp_events x on x.user_id = u.user_id
     group by u.user_id;

create or replace view public.leaderboard as
    select t.user_id,
           trim(u.first_name || ' ' || case when u.last_name <> '' then left(u.last_name, 1) || '.' else '' end) as display_name,
           t.total_xp,
           rank() over (order by t.total_xp desc, t.user_id)::integer as rank
      from public.user_xp_totals t
      join public.users u on u.user_id = t.user_id
     where u.role = 'student' and u.status = 'active';

create or replace function public.current_streak(p_user_id uuid)
returns integer language sql stable set search_path = public as $$
    with today as (
        select (now() at time zone 'Europe/Bucharest')::date as d
    ),
    active_days as (
        select distinct e.awarded_on as day
          from public.xp_events e, today
         where e.user_id = p_user_id and e.awarded_on <= today.d
    ),
    islands as (
        select day, day - (row_number() over (order by day))::integer as island from active_days
    ),
    runs as (
        select island, max(day) as last_day, count(*)::integer as length from islands group by island
    )
    select coalesce((select r.length from runs r, today where r.last_day >= today.d - 1 order by r.last_day desc limit 1), 0);
$$;

create or replace view public.admin_overview as
    select (select count(*) from public.users)::integer as total_users,
           (select count(*) from public.assessments where status = 'submitted')::integer as total_assessments,
           (select coalesce(round(avg(total_score), 1), 0) from public.assessments where status = 'submitted')::numeric as average_score;

create or replace view public.category_score_summary as
    select c.category_id,
           c.name as category_name,
           count(a.assessment_id)::integer as assessments_count,
           round(avg(a.total_score), 1)::numeric as average_score
      from public.skill_categories c
      join public.assessments a on a.category_id = c.category_id and a.status = 'submitted'
     group by c.category_id, c.name;