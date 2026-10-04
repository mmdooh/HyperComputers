-- Run in the Supabase SQL Editor on a new project.
begin;

create table public.laptops (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (length(trim(brand)) > 0),
  model text not null check (length(trim(model)) > 0),
  cpu text not null,
  ram text not null,
  storage text not null,
  gpu text not null,
  price numeric(10,2) not null check (price >= 0),
  image_url text not null,
  status text not null default 'available' check (status in ('available', 'sold')),
  description text not null default '',
  created_at timestamptz not null default now()
);

-- Only the project owner (SQL Editor) can manage this allowlist.
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.laptops enable row level security;
revoke all on public.laptops from anon, authenticated;
grant select on public.laptops to anon, authenticated;
grant insert, update, delete on public.laptops to authenticated;

create policy "Public reads laptops" on public.laptops
  for select to anon, authenticated using (true);
create policy "Admins insert laptops" on public.laptops
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update laptops" on public.laptops
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins delete laptops" on public.laptops
  for delete to authenticated using ((select public.is_admin()));

-- Public images are readable by URL. Uploads and deletions still require admin access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('laptop-images', 'laptop-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']);

create policy "Admins read image metadata" on storage.objects
  for select to authenticated
  using (bucket_id = 'laptop-images' and (select public.is_admin()));
create policy "Admins upload images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'laptop-images' and (select public.is_admin()));
create policy "Admins update images" on storage.objects
  for update to authenticated
  using (bucket_id = 'laptop-images' and (select public.is_admin()))
  with check (bucket_id = 'laptop-images' and (select public.is_admin()));
create policy "Admins delete images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'laptop-images' and (select public.is_admin()));
commit;

-- AFTER creating your admin in Authentication > Users, run separately:
-- insert into public.admin_users (user_id) values ('PASTE_ADMIN_USER_UUID');
-- To revoke admin access:
-- delete from public.admin_users where user_id = 'PASTE_ADMIN_USER_UUID';
