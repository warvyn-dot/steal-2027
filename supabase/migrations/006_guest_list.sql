-- 006: public names are "First L" only, and a public guest list.
-- short_name('Michael Weaver') = 'Michael W'; short_name('Mike') = 'Mike'.
-- get_board now trims every name it returns, so full last names never leave the database
-- through the public functions. The crew-only page (admin_dashboard) still sees full names.

create or replace function public.short_name(p text)
returns text language sql immutable set search_path = public as $$
  select case
    when p is null or btrim(p) = '' then ''
    when array_length(regexp_split_to_array(btrim(p), '\s+'), 1) = 1 then btrim(p)
    else (regexp_split_to_array(btrim(p), '\s+'))[1] || ' ' ||
         upper(left((regexp_split_to_array(btrim(p), '\s+'))[array_length(regexp_split_to_array(btrim(p), '\s+'), 1)], 1))
  end;
$$;

create or replace function public.get_board()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'supplies', coalesce((
      select json_agg(json_build_object('id', s.id, 'name', s.name, 'bring', s.bring,
        'claimers', coalesce((select json_agg(short_name(c.guest_name) order by c.created_at)
                              from supply_claims c where c.supply_id = s.id), '[]'::json)) order by s.sort)
      from supplies s), '[]'::json),
    'beer', coalesce((
      select json_agg(json_build_object('guest_name', short_name(b.guest_name), 'note', b.note) order by b.created_at)
      from beer b), '[]'::json),
    'write_ins', coalesce((
      select json_agg(json_build_object('guest_name', short_name(w.guest_name), 'item', w.item) order by w.created_at)
      from write_ins w), '[]'::json),
    'crew', json_build_object(
      'guests', (select coalesce(sum(party_size), 0) from rsvps),
      'rsvps', (select count(*) from rsvps),
      'claimed', (select count(distinct supply_id) from supply_claims),
      'supplies', (select count(*) from supplies))
  );
$$;

create or replace function public.get_guest_list()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'name', short_name(r.guest_name),
      'party', r.party_size,
      'guests', coalesce((select json_agg(short_name(g))
                          from unnest(coalesce(r.guests, '{}')) g where btrim(g) <> ''), '[]'::json)
    ) order by r.id), '[]'::json)
  from rsvps r;
$$;

revoke execute on function public.get_guest_list() from public;
grant execute on function public.get_guest_list() to anon, authenticated;
grant execute on function public.get_board() to anon, authenticated;
