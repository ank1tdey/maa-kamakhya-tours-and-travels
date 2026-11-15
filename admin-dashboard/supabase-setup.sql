-- Run this entire script in Supabase SQL Editor.
-- Create the first admin user separately in Authentication > Users (disable public signups).
create extension if not exists pgcrypto;
create table if not exists public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
alter table public.admin_users enable row level security;
drop policy if exists "Admin can read own admin record" on public.admin_users;
create policy "Admin can read own admin record" on public.admin_users for select to authenticated using (user_id = auth.uid());

create table if not exists public.packages (
 id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 1 and 100),
 description text not null check (char_length(description) between 1 and 500), category text not null default 'SIGHTSEEING',
 price numeric(10,2) check (price is null or price >= 0), image_url text, sort_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.offers (
 id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 1 and 100),
 description text not null check (char_length(description) between 1 and 500), button_label text not null default 'Enquire Now',
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.gallery (
 id uuid primary key default gen_random_uuid(), image_path text not null unique, image_url text not null,
 alt_text text not null check (char_length(alt_text) between 1 and 160), created_at timestamptz not null default now()
);
alter table public.packages enable row level security;
alter table public.offers enable row level security;
alter table public.gallery enable row level security;
drop policy if exists "Public can read packages" on public.packages;
create policy "Public can read packages" on public.packages for select to anon, authenticated using (true);
drop policy if exists "Admins manage packages" on public.packages;
create policy "Admins manage packages" on public.packages for all to authenticated using (exists (select 1 from public.admin_users a where a.user_id = auth.uid())) with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
drop policy if exists "Public can read active offers" on public.offers;
create policy "Public can read active offers" on public.offers for select to anon, authenticated using (is_active = true);
drop policy if exists "Admins manage offers" on public.offers;
create policy "Admins manage offers" on public.offers for all to authenticated using (exists (select 1 from public.admin_users a where a.user_id = auth.uid())) with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
drop policy if exists "Public can read gallery" on public.gallery;
create policy "Public can read gallery" on public.gallery for select to anon, authenticated using (true);
drop policy if exists "Admins manage gallery rows" on public.gallery;
create policy "Admins manage gallery rows" on public.gallery for all to authenticated using (exists (select 1 from public.admin_users a where a.user_id = auth.uid())) with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('website-gallery','website-gallery',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "Public can view website gallery" on storage.objects;
create policy "Public can view website gallery" on storage.objects for select to anon, authenticated using (bucket_id='website-gallery');
drop policy if exists "Authenticated admins upload gallery" on storage.objects;
create policy "Authenticated admins upload gallery" on storage.objects for insert to authenticated with check (bucket_id='website-gallery' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
drop policy if exists "Authenticated admins delete gallery" on storage.objects;
create policy "Authenticated admins delete gallery" on storage.objects for delete to authenticated using (bucket_id='website-gallery' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Initial package content copied from the existing static website. Prices are intentionally blank.
insert into public.packages (title,description,category,sort_order) values
('Gopiballavpur Sightseeing','Explore Gopiballavpur and its surrounding attractions.','SIGHTSEEING',1),
('Ghatsila Sightseeing','Discover the scenic beauty of Ghatsila and nearby destinations.','SIGHTSEEING',2),
('Local Sightseeing — Jhargram','Visit local attractions and explore the heritage of Jhargram.','LOCAL TOUR',3),
('Belpahari Sightseeing','Plan a memorable trip to Belpahari and its surroundings.','NATURE & SCENIC',4)
on conflict do nothing;
insert into public.offers (title,description,button_label,is_active) values
('Family Travel','Comfortable rides for your next family outing.','Enquire Now',true),
('Outstation Trips','Plan your journey with a vehicle suited to your group.','Enquire Now',true),
('Sightseeing','Discover local attractions with a convenient ride.','Enquire Now',true)
on conflict do nothing;
