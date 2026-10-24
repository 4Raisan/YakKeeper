alter table public.yak_projects add column starter_title text not null default '' check(length(starter_title)<=160);
alter table public.yak_projects add column starter_url text not null default '' check(length(starter_url)<=500);
alter table public.yak_projects add column starter_time text not null default '' check(length(starter_time)<=80);
