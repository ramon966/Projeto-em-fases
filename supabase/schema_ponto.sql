-- Norte Agro Projetos — módulo de Ponto (registro de horas)
-- Rode este arquivo no SQL Editor do Supabase DEPOIS de já ter rodado
-- supabase/schema.sql (a tabela public.users precisa existir antes, por
-- causa das foreign keys abaixo):
-- https://supabase.com/dashboard/project/xnoeuegarsmghjjxiglz/sql/new

-- Horário de trabalho configurado por colaborador (definido pelo admin na
-- tela de Ponto). Quem ainda não tem uma linha aqui usa o padrão de
-- fábrica aplicado no front-end: segunda a sexta, 8h/dia (5x2) — não
-- precisamos semear uma linha por usuário, só o fallback no JS.
create table if not exists public.work_schedules (
  user_id       bigint primary key references public.users(id) on delete cascade,
  -- Dias da semana trabalhados: 1 = segunda ... 7 = domingo (ISO-8601),
  -- guardados como array pra permitir escalas que pulam dias (ex.: folga
  -- no meio da semana), não só "N dias seguidos".
  weekdays      smallint[] not null default '{1,2,3,4,5}',
  hours_per_day numeric(4,2) not null default 8,
  updated_at    timestamptz not null default now()
);

comment on table public.work_schedules is
  'Escala de trabalho por colaborador. Padrão de fábrica (aplicado no front-end quando não há linha aqui): segunda a sexta, 8h/dia. O admin altera por colaborador na tela de Ponto.';

-- Batidas de ponto. Ciclo de 4 por dia: entrada, saída para almoço, volta
-- do almoço, saída final. Uma linha por batida — o tempo trabalhado é
-- calculado no front-end (assets/js/ponto-store.js) a partir dos pares
-- entrada→saída_almoço e volta_almoço→saída; o intervalo de almoço não
-- conta como hora trabalhada.
create table if not exists public.time_punches (
  id          bigint generated always as identity primary key,
  user_id     bigint not null references public.users(id) on delete cascade,
  type        text not null check (type in ('entrada', 'saida_almoco', 'volta_almoco', 'saida')),
  punched_at  timestamptz not null default now()
);

create index if not exists time_punches_user_time_idx
  on public.time_punches (user_id, punched_at desc);

comment on table public.time_punches is
  'Registro de batidas de ponto, uma linha por batida. Sem edição/exclusão pela UI ainda — é o log bruto que alimenta o cálculo de horas.';

-- Row Level Security -----------------------------------------------------
-- Mesma postura do restante do protótipo (ver supabase/schema.sql): ainda
-- não há autenticação real, então liberamos acesso total para a chave
-- anônima só para o front-end funcionar. Isto é INSEGURO para produção —
-- ver README, seção Roadmap.
alter table public.work_schedules enable row level security;
create policy "Prototype: allow anon full access"
  on public.work_schedules
  for all
  to anon
  using (true)
  with check (true);

alter table public.time_punches enable row level security;
create policy "Prototype: allow anon full access"
  on public.time_punches
  for all
  to anon
  using (true)
  with check (true);
