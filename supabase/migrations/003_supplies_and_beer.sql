-- 003: Drinks tab revamp. Guests now claim individual supplies (rum, Coke, limes...) that feed
-- 8 cocktails, sign up to bring beer, and still add write-ins. The cocktail recipes live in the
-- page (app.js); the database only stores what can be claimed and who claimed it.
-- The old drinks/claims tables are left in place, unused, so nothing already saved is lost.

create table if not exists public.supplies (
  id    text primary key,
  name  text not null,
  bring text not null,
  sort  int  not null
);

create table if not exists public.supply_claims (
  id         bigint generated always as identity primary key,
  supply_id  text not null references public.supplies(id) on delete cascade,
  guest_name text not null check (char_length(guest_name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- Several guests may bring the same supply (two bottles of bourbon is fine); one claim per name per supply.
create unique index if not exists supply_claims_one_per_name on public.supply_claims (supply_id, lower(guest_name));

create table if not exists public.beer (
  id         bigint generated always as identity primary key,
  guest_name text not null check (char_length(guest_name) between 1 and 40),
  note       text check (note is null or char_length(note) <= 120),
  created_at timestamptz not null default now()
);

alter table public.supplies enable row level security;
alter table public.supply_claims enable row level security;
alter table public.beer enable row level security;

insert into public.supplies (id, name, bring, sort) values
  ('ragga',        'Silver rum',          'Bacardi or any white rum',       1),
  ('pilok',        'Vodka',               'Tito''s, Absolut, any brand',    2),
  ('richards',     'Bourbon',             'any brand you like',             3),
  ('bleuterd',     'Prosecco',            'two bottles, or champagne',      4),
  ('ecola',        'Coke',                'a 12-pack or two 2-liters',      5),
  ('sprunk',       'Sprite',              'a 12-pack or two 2-liters',      6),
  ('strawberries', 'Frozen strawberries', 'two bags, any brand',            7),
  ('pineapple',    'Pineapple juice',     'one big can',                    8),
  ('coconut',      'Cream of coconut',    'Coco López, not coconut milk',   9),
  ('oj',           'Orange juice',        'Simply or Tropicana',           10),
  ('citrus',       'Limes and lemons',    'a bag of each',                 11),
  ('gin', 'Gin', 'any London dry, like Tanqueray', 12),
  ('tequila', 'Tequila', 'any blanco', 13),
  ('triplesec', 'Triple sec', 'or Cointreau', 14),
  ('simple', 'Simple syrup', 'one bottle, or a jar of sugar water', 15),
  ('bitters', 'Angostura bitters', 'one small bottle', 16),
  ('oranges', 'Oranges', 'a few, for the peel', 17),
  ('bigice', 'Big ice cubes', 'a bag, or a large-cube tray', 18),
  ('midori', 'Midori', 'one bottle', 19),
  ('curacao', 'Blue curaçao', 'one bottle', 20),
  ('pomegranate', 'Pomegranate juice', 'one bottle, like POM', 21)
on conflict (id) do update set name = excluded.name, bring = excluded.bring, sort = excluded.sort;

create or replace function public.claim_supply(p_supply_id text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 1 and 40
     or not exists (select 1 from supplies where id = p_supply_id) then
    return 'invalid';
  end if;
  if (select count(*) from supply_claims where supply_id = p_supply_id) >= 25 then return 'full'; end if;
  insert into supply_claims (supply_id, guest_name) values (p_supply_id, v_name)
  on conflict (supply_id, lower(guest_name)) do nothing;
  if found then return 'ok'; end if;
  return 'already';
end $$;

create or replace function public.add_beer(p_name text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name, '')); v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if char_length(v_name) not between 1 and 40 or char_length(coalesce(v_note, '')) > 120 then
    return 'invalid';
  end if;
  if (select count(*) from beer) >= 100 then return 'full'; end if;
  insert into beer (guest_name, note) values (v_name, v_note);
  return 'ok';
end $$;

create or replace function public.get_board()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'supplies', coalesce((
      select json_agg(json_build_object('id', s.id, 'name', s.name, 'bring', s.bring,
        'claimers', coalesce((select json_agg(c.guest_name order by c.created_at)
                              from supply_claims c where c.supply_id = s.id), '[]'::json)) order by s.sort)
      from supplies s), '[]'::json),
    'beer', coalesce((
      select json_agg(json_build_object('guest_name', b.guest_name, 'note', b.note) order by b.created_at)
      from beer b), '[]'::json),
    'write_ins', coalesce((
      select json_agg(json_build_object('guest_name', w.guest_name, 'item', w.item) order by w.created_at)
      from write_ins w), '[]'::json),
    'crew', json_build_object(
      'guests', (select coalesce(sum(party_size), 0) from rsvps),
      'rsvps', (select count(*) from rsvps),
      'claimed', (select count(distinct supply_id) from supply_claims),
      'supplies', (select count(*) from supplies))
  );
$$;

create or replace function public.admin_dashboard(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return json_build_object('error', v_check); end if;
  return json_build_object(
    'rsvps', coalesce((select json_agg(json_build_object('id', r.id, 'guest_name', r.guest_name,
      'party_size', r.party_size, 'note', r.note, 'guests', r.guests, 'created_at', r.created_at)
      order by r.created_at) from rsvps r), '[]'::json),
    'supply_claims', coalesce((
      select json_agg(json_build_object('id', c.id, 'supply', s.name, 'bring', s.bring,
        'guest_name', c.guest_name, 'created_at', c.created_at) order by c.created_at)
      from supply_claims c join supplies s on s.id = c.supply_id), '[]'::json),
    'beer', coalesce((select json_agg(b order by b.created_at) from beer b), '[]'::json),
    'write_ins', coalesce((select json_agg(w order by w.created_at) from write_ins w), '[]'::json),
    'open_supplies', coalesce((
      select json_agg(s.name order by s.sort) from supplies s
      where not exists (select 1 from supply_claims c where c.supply_id = s.id)), '[]'::json)
  );
end $$;

create or replace function public.admin_release_supply(p_pin text, p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return v_check; end if;
  delete from supply_claims where id = p_id; return 'ok';
end $$;

create or replace function public.admin_delete_beer(p_pin text, p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return v_check; end if;
  delete from beer where id = p_id; return 'ok';
end $$;

revoke execute on function public.claim_supply(text, text) from public;
revoke execute on function public.add_beer(text, text) from public;
revoke execute on function public.admin_release_supply(text, bigint) from public;
revoke execute on function public.admin_delete_beer(text, bigint) from public;
grant execute on function
  public.claim_supply(text, text),
  public.add_beer(text, text),
  public.admin_release_supply(text, bigint),
  public.admin_delete_beer(text, bigint)
to anon, authenticated;
