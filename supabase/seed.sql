
-- Deoarece folosim Supabase Auth, trebuie să inserăm în tabela nativă auth.users.
-- Trigger-ul pe care l-am configurat va crea automat și profilul în public.users.
-- Cont: student@test.com | Parolă: parola123
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111', -- UUID predictibil pentru teste
    'authenticated',
    'authenticated',
    'student@test.com',
    crypt('parola123', gen_salt('bf')), -- Parola encriptată nativ
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name": "Student", "last_name": "Test"}',
    now(),
    now()
);


-- Folosim OVERRIDING SYSTEM VALUE pentru a forța ID-uri fixe (1 și 2).
-- Astfel, testele E2E știu mereu că ID-ul 1 este JavaScript.
INSERT INTO public.skill_categories (category_id, name, description, status)
OVERRIDING SYSTEM VALUE VALUES
(1, 'JavaScript', 'Fundamentele limbajului JavaScript', 'active'),
(2, 'React', 'Dezvoltare frontend cu React', 'active');


INSERT INTO public.questions (question_id, category_id, text, difficulty, status, source)
OVERRIDING SYSTEM VALUE VALUES
(1, 1, 'Ce declarație este folosită pentru a defini o variabilă constantă în JavaScript?', 'beginner', 'active', 'manual'),
(2, 2, 'Care hook este folosit pentru a gestiona starea într-o componentă funcțională?', 'beginner', 'active', 'manual');


INSERT INTO public.answers (question_id, answer_text, is_correct, position) VALUES
-- Răspunsuri pentru întrebarea 1
(1, 'var', false, 0),
(1, 'let', false, 1),
(1, 'const', true, 2),

-- Răspunsuri pentru întrebarea 2
(2, 'useEffect', false, 0),
(2, 'useState', true, 1),
(2, 'useContext', false, 2);