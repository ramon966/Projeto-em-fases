// Feriados/recesso e aniversários da equipe — dados ESTÁTICOS, fixos aqui
// em vez de numa tabela do Supabase. Essa lista muda raramente (uma vez
// por ano, ou quando alguém entra/sai da equipe): não há motivo pra
// depender de rede/banco para isso. Para adicionar ou corrigir uma data,
// edite este arquivo e comite/dê deploy — não é mais um INSERT no banco.
window.CalendarData = (function () {
  // Feriados nacionais fixos + móveis (Carnaval, Sexta-feira Santa e Corpus
  // Christi, calculados a partir da Páscoa de cada ano) + o recesso de fim
  // de ano combinado (19/12/2026–04/01/2027). Os dias 25/12 e 01/01 já são
  // feriado (Natal / Confraternização) — não duplicamos como recesso.
  // NÃO inclui feriado municipal específico de Goiânia (ex.: aniversário da
  // cidade) — sem certeza da data exata, para não arriscar um cálculo de
  // horas errado. Adicione aqui se souber qual é.
  const HOLIDAYS = [
    // 2026
    { date: "2026-01-01", name: "Confraternização Universal", type: "feriado" },
    { date: "2026-02-16", name: "Carnaval", type: "feriado" },
    { date: "2026-02-17", name: "Carnaval", type: "feriado" },
    { date: "2026-04-03", name: "Sexta-feira Santa", type: "feriado" },
    { date: "2026-04-21", name: "Tiradentes", type: "feriado" },
    { date: "2026-05-01", name: "Dia do Trabalho", type: "feriado" },
    { date: "2026-06-04", name: "Corpus Christi", type: "feriado" },
    { date: "2026-09-07", name: "Independência do Brasil", type: "feriado" },
    { date: "2026-10-12", name: "Nossa Senhora Aparecida", type: "feriado" },
    { date: "2026-11-02", name: "Finados", type: "feriado" },
    { date: "2026-11-15", name: "Proclamação da República", type: "feriado" },
    { date: "2026-11-20", name: "Consciência Negra", type: "feriado" },
    { date: "2026-12-19", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-20", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-21", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-22", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-23", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-24", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-25", name: "Natal", type: "feriado" },
    { date: "2026-12-26", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-27", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-28", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-29", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-30", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2026-12-31", name: "Recesso de fim de ano", type: "recesso" },

    // 2027
    { date: "2027-01-01", name: "Confraternização Universal", type: "feriado" },
    { date: "2027-01-02", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2027-01-03", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2027-01-04", name: "Recesso de fim de ano", type: "recesso" },
    { date: "2027-02-08", name: "Carnaval", type: "feriado" },
    { date: "2027-02-09", name: "Carnaval", type: "feriado" },
    { date: "2027-03-26", name: "Sexta-feira Santa", type: "feriado" },
    { date: "2027-04-21", name: "Tiradentes", type: "feriado" },
    { date: "2027-05-01", name: "Dia do Trabalho", type: "feriado" },
    { date: "2027-05-27", name: "Corpus Christi", type: "feriado" },
    { date: "2027-09-07", name: "Independência do Brasil", type: "feriado" },
    { date: "2027-10-12", name: "Nossa Senhora Aparecida", type: "feriado" },
    { date: "2027-11-02", name: "Finados", type: "feriado" },
    { date: "2027-11-15", name: "Proclamação da República", type: "feriado" },
    { date: "2027-11-20", name: "Consciência Negra", type: "feriado" },
    { date: "2027-12-25", name: "Natal", type: "feriado" },
  ];

  // Aniversários da equipe — mês/dia sem ano (se repete todo ano). Puramente
  // informativo: nunca entra no cálculo de horas esperadas, só HOLIDAYS.
  const BIRTHDAYS = [
    { name: "Victor", month: 1, day: 23 },
    { name: "Veronica", month: 1, day: 5 },
    { name: "João Marcelo", month: 3, day: 18 },
    { name: "Brithany", month: 5, day: 21 },
    { name: "Ramon", month: 5, day: 17 },
    { name: "Thainara", month: 6, day: 13 },
    { name: "Nathan", month: 7, day: 26 },
    { name: "Felibe", month: 8, day: 5 },
    { name: "Lara", month: 8, day: 31 },
    { name: "Marina", month: 10, day: 8 },
    { name: "Carol", month: 10, day: 27 },
    { name: "Vinicius", month: 11, day: 10 },
    { name: "Ana Paula", month: 12, day: 22 },
  ];

  return { HOLIDAYS, BIRTHDAYS };
})();
