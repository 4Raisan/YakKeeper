create table public.yak_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.yak_projects(id) on delete cascade,
  github_id text not null,
  login text not null,
  user_id uuid references public.yak_profiles(id),
  status text not null check(status in ('invited','active','removed','declined')),
  source_application_id uuid references public.yak_interactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(project_id,github_id)
);
create index yak_members_user on public.yak_members(user_id,status);
create index yak_members_github on public.yak_members(github_id,status);
create index yak_members_application on public.yak_members(source_application_id);
alter table public.yak_members enable row level security;
revoke all on public.yak_members from anon,authenticated;
grant all on public.yak_members to service_role;
alter table public.yak_projects add column join_policy text not null default 'open' check(join_policy in ('open','invite_only'));

-- Preserve accepted contributors independently of inbox pagination.
insert into public.yak_members(project_id,github_id,login,user_id,status,source_application_id)
select distinct on (i.project_id,p.github_id) i.project_id,p.github_id,p.github_login,p.id,'active',i.id
from public.yak_interactions i join public.yak_profiles p on p.id=i.applicant_id
where i.kind='contribution' and i.status='Accepted' and p.github_id is not null
order by i.project_id,p.github_id,i.created_at desc
on conflict(project_id,github_id) do nothing;

create function public.yak_sync_application_member() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.kind='contribution' and new.status='Accepted' then
    insert into public.yak_members(project_id,github_id,login,user_id,status,source_application_id)
    select new.project_id,p.github_id,p.github_login,p.id,'active',new.id
    from public.yak_profiles p where p.id=new.applicant_id and p.github_id is not null
    on conflict(project_id,github_id) do update set status='active',user_id=excluded.user_id,
      login=excluded.login,source_application_id=excluded.source_application_id;
  elsif tg_op='UPDATE' and old.status='Accepted' and new.status<>'Accepted' then
    update public.yak_members set status='removed' where source_application_id=new.id;
  end if;
  return new;
end $$;
revoke all on function public.yak_sync_application_member() from public,anon,authenticated;
create trigger yak_application_members after insert or update of status on public.yak_interactions
for each row execute function public.yak_sync_application_member();
