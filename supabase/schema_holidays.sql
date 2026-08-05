-- Norte Agro Projetos — feriados e recesso (2026/2027)
-- Rode este arquivo no SQL Editor do Supabase DEPOIS de
-- supabase/schema_ponto.sql (não depende dele por FK, mas segue a mesma
-- ordem de aplicação dos outros arquivos do módulo Ponto).

-- Dias que não contam como "esperado" no cálculo de horas/banco de horas,
-- mesmo caindo num dia da semana em que o colaborador normalmente trabalha
-- (ver expectedMinutes em assets/js/ponto-store.js). Também alimenta o
-- menu "Calendário".
create table if not exists public.holidays (
  id    bigint generated always as identity primary key,
  date  date not null unique,
  name  text not null,
  type  text not null check (type in ('feriado', 'recesso'))
);

comment on table public.holidays is
  'Feriados e períodos de recesso de 2026/2027. Feriados nacionais fixos + móveis (calculados a partir da Páscoa) + o recesso de fim de ano combinado com o admin. NÃO inclui feriados municipais de Goiânia específicos (ex.: aniversário da cidade) — não temos certeza da data exata; adicione manualmente se souber qual é.';

insert into public.holidays (date, name, type) values
  -- 2026
  ('2026-01-01', 'Confraternização Universal', 'feriado'),
  ('2026-02-16', 'Carnaval', 'feriado'),
  ('2026-02-17', 'Carnaval', 'feriado'),
  ('2026-04-03', 'Sexta-feira Santa', 'feriado'),
  ('2026-04-21', 'Tiradentes', 'feriado'),
  ('2026-05-01', 'Dia do Trabalho', 'feriado'),
  ('2026-06-04', 'Corpus Christi', 'feriado'),
  ('2026-09-07', 'Independência do Brasil', 'feriado'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'feriado'),
  ('2026-11-02', 'Finados', 'feriado'),
  ('2026-11-15', 'Proclamação da República', 'feriado'),
  ('2026-11-20', 'Consciência Negra', 'feriado'),
  -- Recesso de fim de ano combinado: 19/12/2026 a 04/01/2027. Os dias 25/12
  -- e 01/01 já são feriado (Natal / Confraternização) — não duplicamos.
  ('2026-12-19', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-20', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-21', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-22', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-23', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-24', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-25', 'Natal', 'feriado'),
  ('2026-12-26', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-27', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-28', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-29', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-30', 'Recesso de fim de ano', 'recesso'),
  ('2026-12-31', 'Recesso de fim de ano', 'recesso'),

  -- 2027
  ('2027-01-01', 'Confraternização Universal', 'feriado'),
  ('2027-01-02', 'Recesso de fim de ano', 'recesso'),
  ('2027-01-03', 'Recesso de fim de ano', 'recesso'),
  ('2027-01-04', 'Recesso de fim de ano', 'recesso'),
  ('2027-02-08', 'Carnaval', 'feriado'),
  ('2027-02-09', 'Carnaval', 'feriado'),
  ('2027-03-26', 'Sexta-feira Santa', 'feriado'),
  ('2027-04-21', 'Tiradentes', 'feriado'),
  ('2027-05-01', 'Dia do Trabalho', 'feriado'),
  ('2027-05-27', 'Corpus Christi', 'feriado'),
  ('2027-09-07', 'Independência do Brasil', 'feriado'),
  ('2027-10-12', 'Nossa Senhora Aparecida', 'feriado'),
  ('2027-11-02', 'Finados', 'feriado'),
  ('2027-11-15', 'Proclamação da República', 'feriado'),
  ('2027-11-20', 'Consciência Negra', 'feriado'),
  ('2027-12-25', 'Natal', 'feriado')
on conflict (date) do nothing;

alter table public.holidays enable row level security;
create policy "Prototype: allow anon full access"
  on public.holidays
  for all
  to anon
  using (true)
  with check (true);
