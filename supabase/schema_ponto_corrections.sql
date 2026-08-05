-- Norte Agro Projetos — justificativas de correção de ponto
-- Rode este arquivo no SQL Editor do Supabase DEPOIS de
-- supabase/schema_ponto.sql (depende da tabela public.users).

-- Registrado toda vez que um colaborador (não-admin) corrige o próprio
-- ponto pelo modal "Corrigir meu ponto" — a justificativa que ele escreve
-- fica aqui para o admin revisar. Correções feitas pelo admin (pela
-- planilha mensal) NÃO passam por aqui — não exigimos justificativa de
-- quem já tem permissão de admin.
create table if not exists public.punch_corrections (
  id             bigint generated always as identity primary key,
  user_id        bigint not null references public.users(id) on delete cascade,
  action         text not null check (action in ('adicionada', 'editada', 'excluida')),
  punch_type     text not null check (punch_type in ('entrada', 'saida_almoco', 'volta_almoco', 'saida')),
  previous_time  timestamptz, -- null quando action = 'adicionada' (não existia antes)
  new_time       timestamptz, -- null quando action = 'excluida' (não existe depois)
  justification  text not null,
  created_at     timestamptz not null default now()
);

create index if not exists punch_corrections_created_idx on public.punch_corrections (created_at desc);

comment on table public.punch_corrections is
  'Justificativas enviadas quando um colaborador corrige o próprio ponto. Alimenta o painel "Justificativas recebidas" do admin.';

alter table public.punch_corrections enable row level security;
create policy "Prototype: allow anon full access"
  on public.punch_corrections
  for all
  to anon
  using (true)
  with check (true);
