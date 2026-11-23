-- Steal 2027: New Year's Eve party database
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to re-run: it drops and recreates everything (and clears all data).

create extension if not exists pgcrypto with schema extensions;

drop function if exists public.get_board();
drop function if exists public.claim_drink(int, text);
drop function if exists public.add_write_in(text, text);
drop function if exists public.submit_rsvp(text, int, text);
drop function if exists public.admin_dashboard(text);
drop function if exists public.admin_release_claim(text, bigint);
drop function if exists public.admin_delete_write_in(text, bigint);
drop function if exists public.admin_delete_rsvp(text, bigint);
drop function if exists public._admin_check(text);
drop table if exists public.claims, public.write_ins, public.rsvps, public.drinks,
  public.admin_settings, public.admin_attempts cascade;

-- ---------- Tables ----------

create table public.drinks (
  id        int primary key,
  name      text not null,
  bring     text not null,
  category  text not null check (category in ('beer', 'noproof', 'liquor')),
  sort      int  not null
);

create table public.claims (
  id          bigint generated always as identity primary key,
  drink_id    int not null unique references public.drinks(id) on delete cascade,
  guest_name  text not null check (char_length(guest_name) between 1 and 40),
  created_at  timestamptz not null default now()
);

create table public.write_ins (
  id          bigint generated always as identity primary key,
  guest_name  text not null check (char_length(guest_name) between 1 and 40),
  item        text not null check (char_length(item) between 1 and 60),
  created_at  timestamptz not null default now()
);

create table public.rsvps (
  id          bigint generated always as identity primary key,
  guest_name  text not null check (char_length(guest_name) between 1 and 40),
  party_size  int  not null check (party_size between 1 and 10),
  note        text check (note is null or char_length(note) <= 200),
  created_at  timestamptz not null default now()
);

create table public.admin_settings (
  id        int primary key default 1 check (id = 1),
  pin_hash  text not null
);

create table public.admin_attempts (
  id          bigint generated always as identity primary key,
  ok          boolean not null,
  created_at  timestamptz not null default now()
);

-- Lock every table: the browser only ever goes through the functions below.
alter table public.drinks         enable row level security;
alter table public.claims         enable row level security;
alter table public.write_ins      enable row level security;
alter table public.rsvps          enable row level security;
alter table public.admin_settings enable row level security;
alter table public.admin_attempts enable row level security;
revoke all on public.drinks, public.claims, public.write_ins, public.rsvps,
  public.admin_settings, public.admin_attempts from anon, authenticated;

-- ---------- Seed ----------

insert into public.drinks (id, name, bring, category, sort) values
  (12, 'Pißwasser',         'Budweiser',                 'beer',    1),
  (13, 'Patriot Beer',      'PBR or Sam Adams',          'beer',    2),
  (14, 'Logger Beer',       'any American lager',        'beer',    3),
  (15, 'Cerveza Barracho',  'Corona or Modelo',          'beer',    4),
  (16, 'Benedict Light',    'any light beer',            'beer',    5),
  (17, 'eCola',             'Coca-Cola',                 'noproof', 1),
  (18, 'Sprunk',            'Sprite',                    'noproof', 2),
  (19, 'FizzAzz',           'Fanta',                     'noproof', 3),
  (20, 'Pißwasser Nein',    'Budweiser Zero',            'noproof', 4),
  (21, 'Ragga Rum',         'Captain Morgan or Bacardi', 'liquor',  1),
  (22, 'Pilok',             'Absolut or Grey Goose',     'liquor',  2),
  (23, 'Richard''s Whiskey', 'any whiskey',              'liquor',  3);

-- Admin PIN, stored hashed. Change it by re-running this line with a new PIN.
insert into public.admin_settings (id, pin_hash)
values (1, extensions.crypt('2237', extensions.gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;

-- ---------- Guest functions ----------

-- Everything the guest page shows: drinks with who claimed them, plus write-ins.
create function public.get_board()
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
      from write_ins w), '[]'::json)
  );
$$;

-- Claim a drink. First claim wins; returns 'ok', 'taken', or 'invalid'.
create function public.claim_drink(p_drink_id int, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 1 and 40
     or not exists (select 1 from drinks where id = p_drink_id) then
    return 'invalid';
  end if;
  insert into claims (drink_id, guest_name) values (p_drink_id, v_name)
  on conflict (drink_id) do nothing;
  if found then return 'ok'; end if;
  return 'taken';
end $$;

create function public.add_write_in(p_name text, p_item text)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name, '')); v_item text := btrim(coalesce(p_item, ''));
begin
  if char_length(v_name) not between 1 and 40 or char_length(v_item) not between 1 and 60 then
    return 'invalid';
  end if;
  if (select count(*) from write_ins) >= 100 then return 'full'; end if;
  insert into write_ins (guest_name, item) values (v_name, v_item);
  return 'ok';
end $$;

create function public.submit_rsvp(p_name text, p_party_size int, p_note text)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name, '')); v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if char_length(v_name) not between 1 and 40 or p_party_size not between 1 and 10
     or (v_note is not null and char_length(v_note) > 200) then
    return 'invalid';
  end if;
  if (select count(*) from rsvps) >= 200 then return 'full'; end if;
  insert into rsvps (guest_name, party_size, note) values (v_name, p_party_size, v_note);
  return 'ok';
end $$;

-- ---------- Admin functions (PIN checked here, never in the browser) ----------

-- Checks the PIN and logs the attempt. Returns 'ok', 'bad_pin', or 'locked'
-- (10 wrong tries in 15 minutes locks admin access for the rest of that window).
-- It returns instead of raising an error so the failed attempt stays logged.
create function public._admin_check(p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  if (select count(*) from admin_attempts
      where not ok and created_at > now() - interval '15 minutes') >= 10 then
    return 'locked';
  end if;
  select pin_hash = extensions.crypt(coalesce(p_pin, ''), pin_hash) into v_ok
  from admin_settings where id = 1;
  insert into admin_attempts (ok) values (coalesce(v_ok, false));
  delete from admin_attempts where created_at < now() - interval '1 day';
  if coalesce(v_ok, false) then return 'ok'; end if;
  return 'bad_pin';
end $$;

create function public.admin_dashboard(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return json_build_object('error', v_check); end if;
  return json_build_object(
    'rsvps', coalesce((select json_agg(r order by r.created_at) from rsvps r), '[]'::json),
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

create function public.admin_release_claim(p_pin text, p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return v_check; end if;
  delete from claims where id = p_id; return 'ok';
end $$;

create function public.admin_delete_write_in(p_pin text, p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return v_check; end if;
  delete from write_ins where id = p_id; return 'ok';
end $$;

create function public.admin_delete_rsvp(p_pin text, p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_check text := _admin_check(p_pin);
begin
  if v_check <> 'ok' then return v_check; end if;
  delete from rsvps where id = p_id; return 'ok';
end $$;

-- Only these functions are callable from the browser (anon key).
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.get_board(),
  public.claim_drink(int, text),
  public.add_write_in(text, text),
  public.submit_rsvp(text, int, text),
  public.admin_dashboard(text),
  public.admin_release_claim(text, bigint),
  public.admin_delete_write_in(text, bigint),
  public.admin_delete_rsvp(text, bigint)
to anon, authenticated;

-- The Data API needs to see the schema to reach these functions.
grant usage on schema public to anon, authenticated;
