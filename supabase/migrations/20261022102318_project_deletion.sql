-- Keep dependent records consistent when an owner deletes a YakKeeper listing.
-- Server-only access and existing RLS remain unchanged.
alter table public.yak_interactions drop constraint yak_interactions_project_id_fkey;
alter table public.yak_interactions add constraint yak_interactions_project_id_fkey foreign key (project_id) references public.yak_projects(id) on delete cascade;
alter table public.yak_reports drop constraint yak_reports_project_id_fkey;
alter table public.yak_reports add constraint yak_reports_project_id_fkey foreign key (project_id) references public.yak_projects(id) on delete cascade;
