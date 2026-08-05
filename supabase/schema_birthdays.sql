-- Norte Agro Projetos — aniversários da equipe
-- Rode este arquivo no SQL Editor do Supabase (independente dos outros —
-- não tem foreign key com nenhuma outra tabela).

-- Guardado como mês/dia (sem ano), porque aniversário se repete todo ano —
-- diferente de holidays, que são datas fixas de anos específicos (2026,
-- 2027). Por isso fica numa tabela separada: aniversário nunca deve entrar
-- no cálculo de horas esperadas (isso é só para o Calendário mostrar).
create table if not exists public.birthdays (
  id    bigint generated always as identity primary key,
  name  text not null,
  month smallint not null check (month between 1 and 12),
  day   smallint not null check (day between 1 and 31)
);

create unique index if not exists birthdays_name_idx on public.birthdays (name);

comment on table public.birthdays is
  'Aniversários da equipe (mês/dia, sem ano — repete todo ano). Puramente informativo: alimenta o menu Calendário, mas NUNCA entra no cálculo de horas esperadas do módulo Ponto (isso é só a tabela holidays).';

insert into public.birthdays (name, month, day) values
  ('Victor', 1, 23),
  ('Veronica', 1, 5),
  ('João Marcelo', 3, 18),
  ('Brithany', 5, 21),
  ('Ramon', 5, 17),
  ('Thainara', 6, 13),
  ('Nathan', 7, 26),
  ('Felibe', 8, 5),
  ('Lara', 8, 31),
  ('Marina', 10, 8),
  ('Carol', 10, 27),
  ('Vinicius', 11, 10),
  ('Ana Paula', 12, 22)
on conflict (name) do nothing;

alter table public.birthdays enable row level security;
create policy "Prototype: allow anon full access"
  on public.birthdays
  for all
  to anon
  using (true)
  with check (true);
