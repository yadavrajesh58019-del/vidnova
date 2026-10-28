-- VidNova starter database schema for Supabase
-- Run this whole file in Supabase Dashboard -> SQL Editor -> New query.
-- The browser app must use only the anon/public key, never service_role.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'VidNova Creator',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'other',
  video_type text not null default 'long' check (video_type in ('long','short')),
  video_url text not null,
  thumbnail_url text,
  views bigint not null default 0 check (views >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);

create table if not exists public.subscriptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, channel_id),
  check (user_id <> channel_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists videos_created_at_idx on public.videos(created_at desc);
create index if not exists videos_category_idx on public.videos(category);
-- Safe migration for projects that already created the original videos table.
alter table public.videos add column if not exists video_type text not null default 'long';
alter table public.videos drop constraint if exists videos_video_type_check;
alter table public.videos add constraint videos_video_type_check check (video_type in ('long','short'));
create index if not exists videos_type_created_idx on public.videos(video_type, created_at desc);
create index if not exists comments_video_created_idx on public.comments(video_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.likes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.comments enable row level security;

drop policy if exists "profiles readable by everyone" on public.profiles;
create policy "profiles readable by everyone" on public.profiles for select using (true);
drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "videos readable by everyone" on public.videos;
create policy "videos readable by everyone" on public.videos for select using (true);
drop policy if exists "signed in users upload own videos" on public.videos;
create policy "signed in users upload own videos" on public.videos for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "owners update own videos" on public.videos;
create policy "owners update own videos" on public.videos for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "owners delete own videos" on public.videos;
create policy "owners delete own videos" on public.videos for delete to authenticated using (auth.uid() = owner_id);

drop policy if exists "likes readable by everyone" on public.likes;
create policy "likes readable by everyone" on public.likes for select using (true);
drop policy if exists "users like as themselves" on public.likes;
create policy "users like as themselves" on public.likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users remove own likes" on public.likes;
create policy "users remove own likes" on public.likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "subscriptions readable by everyone" on public.subscriptions;
create policy "subscriptions readable by everyone" on public.subscriptions for select using (true);
drop policy if exists "users subscribe as themselves" on public.subscriptions;
create policy "users subscribe as themselves" on public.subscriptions for insert to authenticated with check (auth.uid() = user_id and auth.uid() <> channel_id);
drop policy if exists "users remove own subscriptions" on public.subscriptions;
create policy "users remove own subscriptions" on public.subscriptions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "comments readable by everyone" on public.comments;
create policy "comments readable by everyone" on public.comments for select using (true);
drop policy if exists "signed in users add own comments" on public.comments;
create policy "signed in users add own comments" on public.comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments" on public.comments for delete to authenticated using (auth.uid() = user_id);

-- Keep profile rows in sync when new auth users sign up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'VidNova Creator'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage setup: create a PUBLIC bucket named "videos" in Dashboard -> Storage.
-- Then add these policies (or run them if your project allows Storage policy SQL).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 104857600, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 104857600,
  allowed_mime_types = array['video/mp4','video/webm','video/quicktime'];

drop policy if exists "public can view vidnova videos" on storage.objects;
create policy "public can view vidnova videos" on storage.objects
for select using (bucket_id = 'videos');

drop policy if exists "users upload vidnova videos to own folder" on storage.objects;
create policy "users upload vidnova videos to own folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own vidnova videos" on storage.objects;
create policy "users delete own vidnova videos" on storage.objects
for delete to authenticated using (
  bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text
);
