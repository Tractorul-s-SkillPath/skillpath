-- Rolul ales pe formularul de înregistrare ajunge în public.users.
--
-- ---------------------------------------------------------------------------
-- CE ERA STRICAT.
-- ---------------------------------------------------------------------------
--
-- app/(auth)/register/register-form.tsx are un select "Account type" cu
-- Student și Administrator, plus un checkbox de aprobare care apare când alegi
-- Administrator. Ambele câmpuri se trimiteau la server și se pierdeau acolo:
-- registerAction punea în options.data doar first_name și last_name, iar
-- funcția de mai jos scria 'student' fix, indiferent de ce venea.
--
-- Deci cine se înregistra ca Administrator primea un rând de student, iar
-- loginAction — care citește public.users.role, nu formularul — îl trimitea la
-- /dashboard. Ăsta era simptomul raportat: "contul e salvat ca student".
-- Pagina avea până și mesajul `manager_approval_required` scris, pe care nicio
-- ramură de cod nu-l putea declanșa.
--
-- ---------------------------------------------------------------------------
-- CE RENUNȚĂM, EXPLICIT.
-- ---------------------------------------------------------------------------
--
-- Comentariul vechi spunea că 'student' e hardcodat "ca nicio cale de signup
-- să nu poată crea un admin". Migrarea asta renunță la garanția aia, cu bună
-- știință: /register devine o cale publică spre un cont care vede cheia de
-- răspunsuri, iar checkbox-ul "am aprobarea managerului" e bifat chiar de cel
-- care cere rolul, deci consemnează o declarație, nu verifică nimic.
--
-- E o decizie luată pentru proiectul de curs, unde contul de admin trebuie să
-- se poată face din interfață. Într-un sistem real promovarea ar trece printr-un
-- cont de admin existent (o acțiune în /admin/users) sau printr-un cod
-- verificat pe server — vezi și "Acces profil propriu" din
-- 20260902204628_securitate_rls.sql, care oricum e `for all using` fără
-- `with check`, deci un membru își poate rescrie propriul rând.
--
-- `role` vine din raw_user_meta_data, adică din options.data al lui signUp.
-- Orice altceva decât 'admin' devine 'student': o valoare inventată de un POST
-- meșterit ("owner", "") ar crăpa altfel inserarea pe enum, iar un cont din
-- auth.users fără rând în public.users e exact starea pe care
-- getCurrentUser() o tratează ca deconectat.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (user_id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    case
      when new.raw_user_meta_data->>'role' = 'admin' then 'admin'::public.user_role
      else 'student'::public.user_role
    end
  );
  return new;
end;
$$;
