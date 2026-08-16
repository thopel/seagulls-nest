-- À exécuter une fois dans l’éditeur SQL de Supabase.
create extension if not exists pgcrypto;

create table if not exists public.stays (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  city text not null,
  region text not null default '',
  latitude double precision not null,
  longitude double precision not null,
  timezone text not null default 'Europe/Paris',
  tide_site_id text not null,
  tide_site_name text not null,
  floating_image_url text not null default '/assets/seegulls-nest-awake.png',
  floating_image_asleep_url text,
  hidden_sections text[] not null default '{}',
  parking_geojson jsonb,
  useful_links jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stay_managers (
  stay_id uuid not null references public.stays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (stay_id, user_id)
);

alter table public.stays enable row level security;
alter table public.stay_managers enable row level security;

create policy "stays are publicly readable" on public.stays for select using (true);
create policy "managers update their stays" on public.stays for update to authenticated
using (exists (select 1 from public.stay_managers m where m.stay_id = stays.id and m.user_id = auth.uid()))
with check (exists (select 1 from public.stay_managers m where m.stay_id = stays.id and m.user_id = auth.uid()));
create policy "managers see their assignments" on public.stay_managers for select to authenticated using (user_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists stays_touch_updated_at on public.stays;
create trigger stays_touch_updated_at before update on public.stays for each row execute function public.touch_updated_at();

insert into public.stays (slug, name, city, region, latitude, longitude, tide_site_id, tide_site_name)
values ('le-nid-des-mouettes', 'Le nid des mouettes', 'Dinard', 'Côte d’Émeraude', 48.6329, -2.0625, 'saint-malo', 'Saint-Malo')
on conflict (slug) do nothing;

-- Après avoir créé le responsable dans Authentication > Users, attribuez-lui le logement :
-- insert into public.stay_managers (stay_id, user_id)
-- select s.id, u.id from public.stays s cross join auth.users u
-- where s.slug = 'le-nid-des-mouettes' and u.email = 'responsable@exemple.fr';
