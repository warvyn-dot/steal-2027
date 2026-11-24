-- 005: let the crew-only page fix anything guests typed: RSVPs, beer notes,
-- write-ins and the names on supply claims. Same limits as the guest-side functions.

create or replace function public.admin_update_rsvp(p_pin text, p_id bigint, p_name text, p_party_size int, p_note text, p_guests text[] default '{}')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_check text := _admin_check(p_pin);
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_guests text[] := coalesce((select array_agg(btrim(g)) from unnest(coalesce(p_guests, '{}')) g
                               where btrim(coalesce(g, '')) <> ''), '{}');
begin
  if v_check <> 'ok' then return v_check; end if;
  if char_length(v_name) not between 1 and 40 or coalesce(p_party_size, 0) not between 1 and 10
     or (v_note is not null and char_length(v_note) > 200)
     or cardinality(v_guests) > p_party_size - 1
     or exists (select 1 from unnest(v_guests) g where char_length(g) > 40) then
    return 'invalid';
  end if;
  update rsvps set guest_name = v_name, party_size = p_party_size, note = v_note, guests = v_guests where id = p_id;
  if found then return 'ok'; end if;
  return 'not_found';
end $$;

create or replace function public.admin_update_beer(p_pin text, p_id bigint, p_name text, p_note text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_check text := _admin_check(p_pin);
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_check <> 'ok' then return v_check; end if;
  if char_length(v_name) not between 1 and 40 or char_length(coalesce(v_note, '')) > 120 then return 'invalid'; end if;
  update beer set guest_name = v_name, note = v_note where id = p_id;
  if found then return 'ok'; end if;
  return 'not_found';
end $$;

create or replace function public.admin_update_write_in(p_pin text, p_id bigint, p_name text, p_item text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_check text := _admin_check(p_pin);
  v_name text := btrim(coalesce(p_name, ''));
  v_item text := btrim(coalesce(p_item, ''));
begin
  if v_check <> 'ok' then return v_check; end if;
  if char_length(v_name) not between 1 and 40 or char_length(v_item) not between 1 and 60 then return 'invalid'; end if;
  update write_ins set guest_name = v_name, item = v_item where id = p_id;
  if found then return 'ok'; end if;
  return 'not_found';
end $$;

create or replace function public.admin_update_claim(p_pin text, p_id bigint, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_check text := _admin_check(p_pin);
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_check <> 'ok' then return v_check; end if;
  if char_length(v_name) not between 1 and 40 then return 'invalid'; end if;
  update supply_claims set guest_name = v_name where id = p_id;
  if found then return 'ok'; end if;
  return 'not_found';
exception when unique_violation then
  return 'already';
end $$;

revoke execute on function public.admin_update_rsvp(text, bigint, text, int, text, text[]) from public;
revoke execute on function public.admin_update_beer(text, bigint, text, text) from public;
revoke execute on function public.admin_update_write_in(text, bigint, text, text) from public;
revoke execute on function public.admin_update_claim(text, bigint, text) from public;
grant execute on function
  public.admin_update_rsvp(text, bigint, text, int, text, text[]),
  public.admin_update_beer(text, bigint, text, text),
  public.admin_update_write_in(text, bigint, text, text),
  public.admin_update_claim(text, bigint, text)
to anon, authenticated;
