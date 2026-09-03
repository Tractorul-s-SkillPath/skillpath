-- Adaugă topic_title și study_advice pe public.questions.
--
-- ---------------------------------------------------------------------------
-- DE CE E O MIGRARE SEPARATĂ, NU O CORECTURĂ ÎN 20260902204028.
-- ---------------------------------------------------------------------------
--
-- Schema inițială a fost deja aplicată pe proiectul de test. Editarea unei
-- migrări aplicate nu schimbă baza de date — schimbă doar fișierul, iar cele
-- două nu mai corespund; `supabase db push` o consideră aplicată și trece mai
-- departe. Deci coloanele lipsă se adaugă aici.
--
-- ---------------------------------------------------------------------------
-- CE S-A STRICAT FĂRĂ ELE.
-- ---------------------------------------------------------------------------
--
-- `e2e/global-setup.ts` citește `questions.topic_title` ca verificare de formă
-- și a oprit întreaga suită cu:
--
--     column questions.topic_title does not exist
--
-- Verificarea aceea există exact pentru cazul de față: fără ea, fiecare paper
-- de baseline ar fi produs un plan gol, iar testul ar fi raportat "planul e
-- gol" — adevărat, și diagnosticul greșit.
--
-- Cele două coloane sunt sursa recomandărilor: `plan.service` grupează
-- răspunsurile greșite după `topic_title` și scrie `study_advice` în rândul de
-- plan. `lib/supabase/database.types.ts` le declară de la 0004 încoace, la fel
-- și `question.repo`, deci codul le cerea deja.
--
-- `if not exists` pentru că o bază reconstruită de la zero dintr-o schemă
-- inițială corectată ar avea deja coloanele, iar migrarea trebuie să treacă în
-- ambele situații.

alter table public.questions
    add column if not exists topic_title text,
    add column if not exists study_advice text;

-- Nullable, deliberat, și fără DEFAULT.
--
-- Doar cele douăzeci de întrebări din bank-ul de baseline au subiect; celelalte
-- nu au încă, iar formularul de admin nu le scrie. O întrebare fără subiect nu
-- produce nicio recomandare — adică mai puține recomandări, nu recomandări
-- greșite, care e comportamentul corect. Un DEFAULT ar transforma tăcerea
-- aceasta într-un subiect inventat, repetat pe fiecare plan.
comment on column public.questions.topic_title is
    'Ce testează întrebarea. Grupează recomandările în plan.service. Null = nu produce recomandare.';
comment on column public.questions.study_advice is
    'Ce să reciteşti când o greșești. Ajunge în recommendation_plans.rule_description.';
