-- Application tables are accessed through server-side API routes only.
create table public.yak_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null, email text not null,
 role text not null check (role in ('owner','collaborator')),
 created_at timestamptz not null default now()
);
create unique index yak_single_owner on public.yak_profiles(role) where role='owner';
create table public.yak_projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.yak_profiles(id), owner_name text not null,
 title text not null, summary text not null, description text not null,
 category text not null, status text not null,
 tags text not null default '', needs text not null default '', roadmap text not null default '',
 repo text not null default '', demo text not null default '',
 visibility text not null check (visibility in ('public','private','archived')),
 personal boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index yak_project_visibility on public.yak_projects(visibility,updated_at desc);
create index yak_project_owner on public.yak_projects(owner_id);
create table public.yak_invitations (
 id uuid primary key default gen_random_uuid(), hash text not null unique,
 email text not null, expires_at timestamptz not null,
 used_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.yak_interactions (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.yak_projects(id),
 owner_id uuid not null references public.yak_profiles(id),
 kind text not null check (kind in ('idea','contribution')),
 name text not null, email text not null, message text not null,
 status text not null default 'Received' check(status in ('Received','Reviewing','Accepted','Declined')),
 notification text not null default 'not configured', created_at timestamptz not null default now()
);
create index yak_interaction_project on public.yak_interactions(project_id);
create index yak_invitation_user on public.yak_invitations(used_by);
create index yak_inbox_owner on public.yak_interactions(owner_id,created_at desc);
create table public.yak_submission_limits (id text primary key, count integer not null default 1, expires_at timestamptz not null);
create index yak_submission_expiry on public.yak_submission_limits(expires_at);
alter table public.yak_profiles enable row level security;
alter table public.yak_projects enable row level security;
alter table public.yak_invitations enable row level security;
alter table public.yak_interactions enable row level security;
alter table public.yak_submission_limits enable row level security;
revoke all on public.yak_profiles,public.yak_projects,public.yak_invitations,public.yak_interactions,public.yak_submission_limits from anon,authenticated;
grant all on public.yak_profiles,public.yak_projects,public.yak_invitations,public.yak_interactions,public.yak_submission_limits to service_role;

create function public.yak_use_invitation(p_hash text,p_user_id uuid,p_email text,p_name text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare invitation public.yak_invitations;
begin
 select * into invitation from public.yak_invitations where hash=p_hash and used_by is null and expires_at>now() and lower(email)=lower(p_email) for update;
 if not found then return false; end if;
 insert into public.yak_profiles(id,name,email,role) values(p_user_id,p_name,p_email,'collaborator');
 update public.yak_invitations set used_by=p_user_id where id=invitation.id;
 return true;
end; $$;
revoke all on function public.yak_use_invitation(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.yak_use_invitation(text,uuid,text,text) to service_role;

create function public.yak_limit_submission(p_id text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare attempts integer;
begin
 delete from public.yak_submission_limits where expires_at<now();
 insert into public.yak_submission_limits(id,count,expires_at) values(p_id,1,now()+interval '1 hour')
 on conflict(id) do update set count=yak_submission_limits.count+1 returning count into attempts;
 return attempts<=5;
end; $$;
revoke all on function public.yak_limit_submission(text) from public,anon,authenticated;
grant execute on function public.yak_limit_submission(text) to service_role;
