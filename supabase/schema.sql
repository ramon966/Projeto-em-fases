-- Norte Agro Projetos — schema inicial (tabela de usuários)
-- Espelha os campos que já existem no protótipo (assets/js/users-store.js):
-- id, name, email, role, isAdmin (derivado), photo, createdAt.
--
-- Rode este arquivo inteiro no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/xnoeuegarsmghjjxiglz/sql/new

create table if not exists public.users (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text not null unique,
  role        text not null check (role in ('Usuário', 'Admin', 'Estagiário')),
  is_admin    boolean generated always as (role = 'Admin') stored,
  -- Foto como data URL (base64), igual ao protótipo hoje. Quando o volume de
  -- fotos crescer, trocar por uma URL do Supabase Storage é a evolução natural.
  photo       text,
  created_at  timestamptz not null default now()
);

comment on table public.users is
  'Usuários da plataforma. Sem coluna de senha ainda — o login atual não é real (ver README). Adicionar autenticação via Supabase Auth troca esse modelo.';

-- Dados de teste (mesmos 3 usuários que hoje vêm de fábrica no localStorage).
insert into public.users (name, email, role) values
  ('Administrador',  'admin@norteagro.com.br',       'Admin'),
  ('Equipe Técnica',  'tecnica@norteagro.com.br',     'Usuário'),
  ('Atendimento',     'atendimento@norteagro.com.br', 'Usuário')
on conflict (email) do nothing;

-- Row Level Security -----------------------------------------------------
-- O Supabase bloqueia leitura/escrita por padrão assim que RLS é ligado.
-- Como ainda não há autenticação real (ver README — "Sem autenticação
-- real"), as policies abaixo liberam acesso total para a chave anônima,
-- só para o front-end atual continuar funcionando. Isto é INSEGURO para
-- produção: qualquer pessoa com a anon key lê/edita/apaga todos os
-- usuários. Apertar isso é parte do roadmap (autenticação real).
alter table public.users enable row level security;

create policy "Prototype: allow anon full access"
  on public.users
  for all
  to anon
  using (true)
  with check (true);
