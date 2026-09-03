-- leaderboard: departajarea la egalitate de XP se face după data înscrierii.
--
-- ---------------------------------------------------------------------------
-- ACEEAȘI CLASĂ DE REGRESIE CA ORDONAREA DIN user.repo.listPaged.
-- ---------------------------------------------------------------------------
--
-- View-ul avea:
--
--     rank() over (order by t.total_xp desc, t.user_id)
--
-- Cât timp `user_id` era un identity crescător, `t.user_id` însemna "cine s-a
-- înscris primul" — la XP egal, membrul mai vechi era mai sus, iar cel mai nou
-- ultimul. Intenția era vizibilă în cod.
--
-- După migrarea la UUID, `t.user_id` e aleator. Departajarea a rămas
-- deterministă — același clasament la două citiri, deci dashboard-ul nu
-- pâlpâie — dar nu mai înseamnă nimic: la XP egal ordinea e dată de octeții
-- unui UUID.
--
-- S-a văzut în tests/lib/repositories/xp.repo.test.ts: un membru nou, cu 0 XP,
-- ar trebui să fie ultimul. A ieșit pe locul 25 din 46, printre ceilalți cu 0
-- XP, în funcție de UUID-ul primit.
--
-- `u.created_at` restaurează sensul original. Ordinea rămâne totală și stabilă
-- (user_id e păstrat ca ultim criteriu, pentru cei înscriși în aceeași
-- tranzacție — seed-ul inserează mai mulți deodată), dar la egalitate câștigă
-- vechimea, nu norocul.

create or replace view public.leaderboard as
    select t.user_id,
           trim(u.first_name || ' ' || case when u.last_name <> '' then left(u.last_name, 1) || '.' else '' end) as display_name,
           t.total_xp,
           rank() over (order by t.total_xp desc, u.created_at, t.user_id)::integer as rank
      from public.user_xp_totals t
      join public.users u on u.user_id = t.user_id
     where u.role = 'student' and u.status = 'active';
