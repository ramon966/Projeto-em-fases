-- Norte Agro Projetos — solicitações de correção de ponto
-- Rode este arquivo no SQL Editor do Supabase DEPOIS de
-- supabase/schema_ponto.sql (depende das tabelas public.users e
-- public.time_punches).
--
-- Já tinha essa tabela de um deploy anterior (fluxo antigo, sem aprovação)?
-- Rode o arquivo inteiro mesmo assim — `create table if not exists` e os
-- `alter table ... add column if not exists` do fim são no-ops seguros
-- sobre o que já existe. A ÚNICA parte que não deve rodar de novo é o
-- bloco "BACKFILL (rodar só uma vez)" no final — veja o aviso lá.

-- Toda vez que um colaborador (não-admin) pede uma adição, correção ou
-- exclusão no próprio ponto pelo modal "Solicitar correção de ponto", vira
-- uma linha aqui com status 'pendente' — NINGUÉM mexe em time_punches nesse
-- momento. Só quando o admin aprova (painel "Solicitações de correção") é
-- que a alteração é de fato aplicada em time_punches; rejeitar só marca o
-- status, sem tocar na batida. Correções feitas pelo admin direto na
-- planilha mensal NÃO passam por aqui — não exigimos aprovação de quem já
-- tem permissão de admin.
create table if not exists public.punch_corrections (
  id             bigint generated always as identity primary key,
  user_id        bigint not null references public.users(id) on delete cascade,
  -- Batida existente que a solicitação afeta (edição/exclusão). Nulo quando
  -- action = 'adicionada' — ainda não existe batida nenhuma pra apontar.
  punch_id       bigint references public.time_punches(id) on delete cascade,
  action         text not null check (action in ('adicionada', 'editada', 'excluida')),
  punch_type     text not null check (punch_type in ('entrada', 'saida_almoco', 'volta_almoco', 'saida')),
  previous_time  timestamptz, -- null quando action = 'adicionada' (não existia antes)
  new_time       timestamptz, -- null quando action = 'excluida' (não existe depois)
  justification  text not null,
  status         text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada')),
  reviewed_at    timestamptz,
  reviewed_by    bigint references public.users(id) on delete set null, -- admin que aprovou/rejeitou
  created_at     timestamptz not null default now()
);

-- Migração pra quem já tinha a tabela antes desses campos existirem (fluxo
-- antigo: colaborador aplicava a correção na hora e isso só registrava o
-- log). Cada linha é um "add column if not exists" — não-op numa instalação
-- nova, já criada com a definição acima; segura de rodar de novo sempre.
-- Precisa vir ANTES dos `create index`/`create policy` abaixo: numa
-- instalação já existente o `create table if not exists` acima é um no-op,
-- então colunas como `status` só passam a existir de fato aqui.
alter table public.punch_corrections add column if not exists punch_id bigint references public.time_punches(id) on delete cascade;
alter table public.punch_corrections add column if not exists status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada'));
alter table public.punch_corrections add column if not exists reviewed_at timestamptz;
alter table public.punch_corrections add column if not exists reviewed_by bigint references public.users(id) on delete set null;

create index if not exists punch_corrections_created_idx on public.punch_corrections (created_at desc);
create index if not exists punch_corrections_status_idx on public.punch_corrections (status);

comment on table public.punch_corrections is
  'Solicitações de adição/correção/exclusão de ponto enviadas por colaboradores. Ficam com status pendente até o admin aprovar (aplica em time_punches) ou rejeitar (só marca o status) no painel "Solicitações de correção".';

alter table public.punch_corrections enable row level security;
drop policy if exists "Prototype: allow anon full access" on public.punch_corrections;
create policy "Prototype: allow anon full access"
  on public.punch_corrections
  for all
  to anon
  using (true)
  with check (true);

-- BACKFILL (rodar só uma vez, junto com a migração acima — NÃO rode este
-- bloco de novo depois que colaboradores já estiverem enviando pedidos de
-- verdade pelo novo fluxo).
--
-- A coluna `status` acima nasce com default 'pendente' — então toda linha
-- que já existia na tabela (do fluxo antigo, onde a correção já tinha sido
-- aplicada em time_punches na hora) fica marcada como 'pendente' por
-- engano. Sem este UPDATE, essas linhas antigas apareceriam no painel do
-- admin pedindo aprovação de novo — e clicar "Aprovar" nelas tentaria
-- reaplicar algo que já aconteceu (ex.: inserir uma batida duplicada).
-- Marca como 'aprovada' (reviewed_at = created_at, já que na prática já
-- tinha sido "aprovada" no ato) tudo que ainda não passou pelo fluxo novo.
update public.punch_corrections
set status = 'aprovada', reviewed_at = created_at
where reviewed_at is null;
