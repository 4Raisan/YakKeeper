alter table public.yak_projects add column if not exists banner_path text not null default '';

-- Private objects: only the server uploads and signs links after listing access checks.
-- No anon/authenticated storage policies are granted for this bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('project-banners','project-banners',false,131072,array['image/webp'])
on conflict (id) do nothing;
