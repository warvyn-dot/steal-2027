-- Lets a guest change or cancel their own RSVP from the same phone, and shows crew totals publicly.

alter table public.rsvps add column if not exists edit_token uuid not null default gen_random_uuid();

-- Like submit_rsvp, but returns the new RSVP's id and a private edit token the phone keeps.
create or replace function public.submit_rsvp_v2(p_name text, p_party_size int, p_note text, p_guests text[] default '{}')
returns json language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_guests text[] := coalesce((select array_agg(btrim(g)) from unnest(coalesce(p_guests, '{}')) g
                               where btrim(coalesce(g, '')) <> ''), '{}');
  v_row rsvps;
begin
  if char_length(v_name) not between 1 and 40 or p_party_size not between 1 and 10
     or (v_note is not null and char_length(v_note) > 200)
     or cardinality(v_guests) > p_party_size - 1
     or exists (select 1 from unnest(v_guests) g where char_length(g) > 40) then
    return json_build_object('status', 'invalid');
  end if;
  if (select count(*) from rsvps) >= 200 then return json_build_object('status', 'full'); end if;
  insert into rsvps (guest_name, party_size, note, guests) values (v_name, p_party_size, v_note, v_guests)
  returning * into v_row;
  return json_build_object('status', 'ok', 'id', v_row.id, 'token', v_row.edit_token);
end $$;

-- Change an RSVP. Needs the id and token the phone got back when it was created.
create or replace function public.update_rsvp(p_id bigint, p_token uuid, p_name text, p_party_size int, p_note text, p_guests text[] default '{}')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_guests text[] := coalesce((select array_agg(btrim(g)) from unnest(coalesce(p_guests, '{}')) g
                               where btrim(coalesce(g, '')) <> ''), '{}');
begin
  if char_length(v_name) not between 1 and 40 or p_party_size not between 1 and 10
     or (v_note is not null and char_length(v_note) > 200)
     or cardinality(v_guests) > p_party_size - 1
     or exists (select 1 from unnest(v_guests) g where char_length(g) > 40) then
    return 'invalid';
  end if;
  update rsvps set guest_name = v_name, party_size = p_party_size, note = v_note, guests = v_guests
  where id = p_id and edit_token = p_token;
  if found then return 'ok'; end if;
  return 'not_found';
end $$;

create or replace function public.cancel_rsvp(p_id bigint, p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  delete from rsvps where id = p_id and edit_token = p_token;
  if found then return 'ok'; end if;
  return 'not_found';
end $$;

-- Guest board now includes crew totals (numbers only, no names).
create or replace function public.get_board()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'drinks', coalesce((
      select json_agg(json_build_object(
        'id', d.id, 'name', d.name, 'bring', d.bring, 'category', d.category,
        'claimed_by', c.guest_name) order by d.category, d.sort)
      from drinks d left join claims c on c.drink_id = d.id), '[]'::json),
    'write_ins', coalesce((
      select json_agg(json_build_object('guest_name', w.guest_name, 'item', w.item)
        order by w.created_at)
      from write_ins w), '[]'::json),
    'crew', json_build_object(
      'guests', (select coalesce(sum(party_size), 0) from rsvps),
      'rsvps', (select count(*) from rsvps),
      'claimed', (select count(*) from claims),
      'drinks', (select count(*) from drinks))
  );
$$;

-- Admin view: same as before, but never sends edit tokens.
create or replace function public.admin_dashboard(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return json_build_object('error', v_check); end if;
  return json_build_object(
    'rsvps', coalesce((select json_agg(json_build_object('id', r.id, 'guest_name', r.guest_name,
      'party_size', r.party_size, 'note', r.note, 'guests', r.guests, 'created_at', r.created_at)
      order by r.created_at) from rsvps r), '[]'::json),
    'claims', coalesce((
      select json_agg(json_build_object('id', c.id, 'drink', d.name, 'bring', d.bring,
        'category', d.category, 'guest_name', c.guest_name, 'created_at', c.created_at)
        order by c.created_at)
      from claims c join drinks d on d.id = c.drink_id), '[]'::json),
    'write_ins', coalesce((select json_agg(w order by w.created_at) from write_ins w), '[]'::json),
    'open_drinks', coalesce((
      select json_agg(d.name order by d.category, d.sort) from drinks d
      where not exists (select 1 from claims c where c.drink_id = d.id)), '[]'::json)
  );
end $$;

revoke execute on function public.submit_rsvp_v2(text, int, text, text[]) from public;
revoke execute on function public.update_rsvp(bigint, uuid, text, int, text, text[]) from public;
revoke execute on function public.cancel_rsvp(bigint, uuid) from public;
grant execute on function
  public.submit_rsvp_v2(text, int, text, text[]),
  public.update_rsvp(bigint, uuid, text, int, text, text[]),
  public.cancel_rsvp(bigint, uuid)
to anon, authenticated;
