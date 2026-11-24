-- 004: the host's shopping checklist on the crew-only page.
-- Run after 003. Adds host_items (things Sean buys himself), seeds a starter list,
-- and returns the full supply list with claimers from admin_dashboard so the
-- crew half of the checklist ticks itself as guests claim things.

create table if not exists public.host_items (
  id bigserial primary key,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  section text not null default 'Extras' check (char_length(section) between 1 and 40),
  done boolean not null default false,
  sort int not null default 1000,
  created_at timestamptz not null default now()
);
alter table public.host_items enable row level security;
-- No policies: only the security definer functions below can read or change it.

insert into public.host_items (name, section, sort)
select v.name, v.section, v.sort from (values
  ('Bagged ice, about 2 lb per guest',          'Ice and cold',     10),
  ('Cooler for beer and mixers',                'Ice and cold',     20),
  ('Ice bucket and scoop',                      'Ice and cold',     30),
  ('Plastic champagne flutes',                  'Glasses and serving', 110),
  ('Plastic cups, short and tall',              'Glasses and serving', 120),
  ('Straws',                                    'Glasses and serving', 130),
  ('Cocktail napkins',                          'Glasses and serving', 140),
  ('Paper plates',                              'Glasses and serving', 150),
  ('Sharpie for names on cups',                 'Glasses and serving', 160),
  ('Pitcher for the Liberty City batch',        'Bar tools',        210),
  ('Blender, tested',                           'Bar tools',        220),
  ('Shaker and jigger',                         'Bar tools',        230),
  ('Bottle opener and corkscrew',               'Bar tools',        240),
  ('Cutting board and knife for citrus',        'Bar tools',        250),
  ('Cocktail picks for garnish',                'Bar tools',        260),
  ('Beer pong cups',                            'Beer pong',        280),
  ('Ping pong balls',                           'Beer pong',        290),
  ('Backup prosecco for the toast',             'Midnight',         310),
  ('Countdown on the TV',                       'Midnight',         350),
  ('String lights',                             'Neon and florals', 410),
  ('Glow sticks',                               'Neon and florals', 420),
  ('Tropical flowers or leis',                  'Neon and florals', 430),
  ('Backup snacks',                             'Food and water',   510),
  ('Bottled water',                             'Food and water',   520),
  ('Sparkling water for non-drinkers',          'Food and water',   530),
  ('Trash bags',                                'Cleanup',          610),
  ('Paper towels',                              'Cleanup',          620),
  ('Extra toilet paper',                        'Cleanup',          630),
  ('A spot for recycling',                      'Cleanup',          640),
  ('Ride-home plan for anyone who needs one',   'Cleanup',          650)
) as v(name, section, sort)
where not exists (select 1 from public.host_items);

create or replace function public.admin_dashboard(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return json_build_object('error', v_check); end if;
  return json_build_object(
    'rsvps', coalesce((select json_agg(json_build_object('id', r.id, 'guest_name', r.guest_name,
      'party_size', r.party_size, 'note', r.note, 'guests', r.guests, 'created_at', r.created_at)
      order by r.created_at) from rsvps r), '[]'::json),
    'supplies', coalesce((
      select json_agg(json_build_object('id', s.id, 'name', s.name, 'bring', s.bring,
        'claims', coalesce((select json_agg(json_build_object('id', c.id, 'guest_name', c.guest_name,
          'created_at', c.created_at) order by c.created_at) from supply_claims c where c.supply_id = s.id), '[]'::json))
        order by s.sort) from supplies s), '[]'::json),
    'supply_claims', coalesce((
      select json_agg(json_build_object('id', c.id, 'supply_id', s.id, 'supply', s.name, 'bring', s.bring,
        'guest_name', c.guest_name, 'created_at', c.created_at) order by c.created_at)
      from supply_claims c join supplies s on s.id = c.supply_id), '[]'::json),
    'beer', coalesce((select json_agg(b order by b.created_at) from beer b), '[]'::json),
    'write_ins', coalesce((select json_agg(w order by w.created_at) from write_ins w), '[]'::json),
    'open_supplies', coalesce((
      select json_agg(s.name order by s.sort) from supplies s
      where not exists (select 1 from supply_claims c where c.supply_id = s.id)), '[]'::json),
    'host_items', coalesce((select json_agg(json_build_object('id', h.id, 'name', h.name,
      'section', h.section, 'done', h.done) order by h.sort, h.id) from host_items h), '[]'::json)
  );
end $$;

create or replace function public.admin_host_toggle(p_pin text, p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return v_check; end if;
  update host_items set done = not done where id = p_id;
  if not found then return 'invalid'; end if;
  return 'ok';
end $$;

create or replace function public.admin_host_add(p_pin text, p_name text, p_section text default 'Extras')
returns text language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return v_check; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then return 'invalid'; end if;
  insert into host_items (name, section, sort)
  values (btrim(p_name), coalesce(nullif(btrim(left(p_section, 40)), ''), 'Extras'), 9000);
  return 'ok';
end $$;

create or replace function public.admin_host_delete(p_pin text, p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return v_check; end if;
  delete from host_items where id = p_id; return 'ok';
end $$;

revoke execute on function public.admin_host_toggle(text, bigint) from public;
revoke execute on function public.admin_host_add(text, text, text) from public;
revoke execute on function public.admin_host_delete(text, bigint) from public;
grant execute on function
  public.admin_host_toggle(text, bigint),
  public.admin_host_add(text, text, text),
  public.admin_host_delete(text, bigint)
to anon, authenticated;
