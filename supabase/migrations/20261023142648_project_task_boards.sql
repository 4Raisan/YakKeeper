-- Team boards use the same server-managed access boundary as applications.
create table public.yak_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.yak_projects(id) on delete cascade,
  author_id uuid not null references public.yak_profiles(id),
  title text not null check (length(trim(title)) between 3 and 160),
  description text not null default '' check (length(description) <= 2000),
  status text not null default 'Future' check (status in ('Future','Ongoing','Finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index yak_tasks_project on public.yak_tasks(project_id,created_at desc);
create index yak_tasks_author on public.yak_tasks(author_id);
create table public.yak_task_workers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.yak_tasks(id) on delete cascade,
  user_id uuid not null references public.yak_profiles(id),
  login text not null,
  created_at timestamptz not null default now(),
  unique(task_id,user_id)
);
create index yak_task_workers_user on public.yak_task_workers(user_id);
alter table public.yak_tasks enable row level security;
alter table public.yak_task_workers enable row level security;
revoke all on public.yak_tasks,public.yak_task_workers from anon,authenticated;
grant all on public.yak_tasks,public.yak_task_workers to service_role;
