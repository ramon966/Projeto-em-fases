# Norte Agro Projetos — Acesso

Tela de login, gestão de usuários e registro de ponto com a identidade
visual da Norte Agro Projetos (regularização de imóveis rurais). Suporta
modo claro/escuro, menu lateral recolhível e visualização de usuários em
grade ou lista.

## Status atual

Este é um **protótipo de front-end** conectado a um banco Supabase
real, mas ainda sem backend/autenticação próprios. Serve para validar
fluxo, layout e identidade visual com dados persistentes antes de
investir em uma versão com autenticação real. Pontos importantes:

- **Persistência real via Supabase.** Os usuários cadastrados ficam
  salvos na tabela `public.users` do Supabase (ver
  [supabase/schema.sql](supabase/schema.sql)) — são compartilhados
  entre dispositivos e sobrevivem a uma limpeza de dados do navegador.
- **Sem autenticação real.** O formulário de login aceita qualquer
  usuário/senha preenchidos. O e-mail digitado é comparado com os
  usuários cadastrados no Supabase apenas para decidir de qual conta
  é a sessão (e assim liberar o cadastro de novos usuários, se o
  cargo for Admin).
- **Sem senha validada.** Ao criar um usuário, a senha é apenas
  exigida no formulário; ela não é enviada ao banco nem usada para
  autenticar depois.
- **Banco aberto para a chave anônima.** A tabela `users` tem Row
  Level Security ativada, mas com uma policy que libera leitura e
  escrita total para a `anon key` — necessário porque ainda não há
  autenticação real. Isso é inseguro para produção; ver
  [Roadmap](#roadmap).
- **Foto de perfil sem upload real.** A foto escolhida é lida no
  navegador e guardada como base64 na própria coluna `photo` da
  tabela — não vai para um bucket de arquivos. Cadastrar muitas fotos
  grandes pode ficar pesado; migrar para o Supabase Storage é a
  evolução natural quando isso virar um problema.

Nenhum desses pontos é um bug — é o estágio esperado de um protótipo
em transição para dados reais. Veja [Roadmap](#roadmap) para o que
falta para produção.

## Estrutura do projeto

```
Projeto-em-fases-/
├── index.html                    # estrutura da página (login, sidebar, grid, modal, ponto)
├── assets/
│   ├── css/
│   │   └── styles.css            # todo o visual: tokens de cor, tema claro/escuro, layout
│   └── js/
│       ├── supabase-client.js    # conexão com o Supabase (URL + anon key)
│       ├── calendar-data.js      # feriados/recesso e aniversários — dados fixos, sem Supabase
│       ├── theme.js              # alternância de tema claro/escuro
│       ├── users-store.js        # camada de dados de usuários (hoje: Supabase)
│       ├── ponto-store.js        # camada de dados de ponto + cálculo de horas (Supabase + calendar-data.js)
│       └── app.js                # lógica de UI: views, grid, modal, login, sidebar, ponto
├── supabase/
│   ├── schema.sql                     # schema da tabela users + policies de RLS
│   ├── schema_ponto.sql               # schema de work_schedules e time_punches + RLS
│   └── schema_ponto_corrections.sql   # schema de punch_corrections (justificativas) + RLS
├── .gitignore
└── README.md
```

`users-store.js` e `ponto-store.js` existem separados de propósito: são
os únicos lugares que sabem que os dados vêm do Supabase. Se um dia
trocar de provedor de banco ou ganhar um backend próprio, só esses
arquivos precisam mudar — o resto da UI (`app.js`) não muda.

**Cache do CSS/JS:** `index.html` carrega `styles.css` e cada `assets/js/*.js`
com um `?v=N` — esse `?v=` existe só pra forçar o navegador a buscar o
arquivo de novo a cada mudança (sem isso, uma edição pode continuar em
cache mesmo depois de um refresh normal, e o navegador roda código
velho sem avisar — inclusive assumindo comportamento que já não é o do
código atual). **Toda vez que mexer num desses arquivos, incremente o
`?v=` só dele** (`?v=3`, `?v=4`, ...); não precisa mexer no dos que não
mudaram.

## Como rodar localmente

Não há build step. É só servir a pasta como arquivos estáticos:

```bash
# com Python (já vem instalado na maioria dos sistemas)
python -m http.server 5500

# ou com Node, se preferir
npx serve .
```

Depois abra `http://localhost:5500`. Abrir o `index.html` direto com
duplo clique (`file://`) também funciona normalmente — os scripts são
carregados como `<script>` clássico (não como ES Module), então não
esbarram na restrição de CORS que navegadores aplicam a módulos
carregados via `file://`.

Como os dados de usuários e ponto vêm do Supabase, é preciso **conexão
com a internet** e que as tabelas já existam no banco — rode, nessa
ordem (cada um depende do anterior por causa das foreign keys),
[supabase/schema.sql](supabase/schema.sql),
[supabase/schema_ponto.sql](supabase/schema_ponto.sql) e
[supabase/schema_ponto_corrections.sql](supabase/schema_ponto_corrections.sql)
no SQL Editor do projeto Supabase antes de abrir a página pela
primeira vez. Feriados e aniversários **não** precisam disso — vêm
fixos de [assets/js/calendar-data.js](assets/js/calendar-data.js) (ver
[Calendário](#calendário-feriados-recesso-e-aniversários) abaixo).

## Dados de teste

Três usuários já vêm cadastrados de fábrica (inseridos pelo próprio
[supabase/schema.sql](supabase/schema.sql) ao rodar no banco):

| Nome            | E-mail                       | Cargo   |
|-----------------|-------------------------------|---------|
| Administrador   | admin@norteagro.com.br        | Admin   |
| Equipe Técnica  | tecnica@norteagro.com.br      | Usuário |
| Atendimento     | atendimento@norteagro.com.br  | Usuário |

Qualquer senha funciona no login. O cargo é escolhido em uma lista fixa
(Usuário / Admin / Estagiário); só quem tem cargo **Admin** vê o botão
"Adicionar usuário" — a permissão é derivada do cargo, não é um campo
à parte, então os dois nunca ficam contraditórios.

## Ponto (registro de horas)

Menu "Ponto" na sidebar, disponível para qualquer colaborador logado:

- **Bater o ponto** com ciclo de 4 batidas por dia: entrada, saída para
  almoço, volta do almoço, saída final. O botão sempre mostra a próxima
  batida esperada e reinicia o ciclo em "entrada" no dia seguinte
  (mesmo que o dia anterior tenha ficado sem a última batida).
- **Último ponto batido**, com tipo e horário.
- **Horas no mês**: horas trabalhadas desde o dia 1 até hoje comparadas
  com as horas esperadas no mesmo período, considerando só os dias da
  semana em que o colaborador trabalha.
- **Banco de horas**: a diferença entre trabalhado e esperado no mês,
  em horas e minutos — positivo é crédito, negativo é o quanto está
  devendo. O intervalo de almoço não conta como hora trabalhada.

Quem tem cargo **Admin** vê também um painel para configurar a escala de
cada colaborador (dias da semana + horas por dia). Escala padrão de
fábrica, usada até o admin configurar algo diferente: **segunda a
sexta, 8h/dia (5x2, 40h/semana)**.

**Admin não bate ponto.** O card de bater ponto/horas/banco de horas
some para quem tem cargo Admin — a página dele mostra só o painel de
gestão (escala + planilha + justificativas), descrito abaixo.

**Correção de ponto**, com regras diferentes por cargo:

- **Colaborador comum** não corrige o próprio ponto diretamente — ele
  **solicita**, pelo botão "Solicitar correção": um modal de um dia
  específico, com todas as batidas daquele dia (pedir a adição de uma
  esquecida, a edição de tipo/horário de uma errada, ou a exclusão de
  uma duplicada). É **obrigatório escrever uma justificativa** antes de
  enviar qualquer pedido. Nada em `time_punches` muda nesse momento —
  o pedido fica pendente (uma batida com pedido em aberto mostra
  "Pendente" em vez dos botões, pra não pedir a mesma coisa duas
  vezes) e some pro colaborador em "Minhas solicitações", dentro do
  próprio modal, com o status atualizado.
- **Admin** decide cada pedido no painel "Solicitações de correção"
  (pendentes primeiro): **Aprovar** aplica a alteração de fato em
  `time_punches` (é o único momento em que uma correção de colaborador
  muda o ponto dele); **Rejeitar** só marca o pedido como recusado, sem
  tocar em nada. Além disso, o admin corrige o ponto de **qualquer**
  colaborador diretamente (sem passar por aprovação) pelo ícone de
  relógio na lista de colaboradores, numa **planilha do mês inteiro**
  (estilo Excel): uma linha por dia do mês corrente, seguindo o
  calendário real (28 a 31 dias, conforme o mês/ano — o mesmo
  calendário usado no Brasil), com os 4 horários do dia editáveis lado
  a lado e total/esperado/diferença calculados na hora. Dá pra navegar
  entre meses.

**Ver pontos** (botão ao lado de "Horário e correção..."): abre um
modal com o ponto de **todos os colaboradores ao mesmo tempo**, mês
corrente (dia 1 até o último dia do mês), numa tabela horizontal —
nome fixo na coluna da esquerda, um dia por coluna (com os horários
batidos), cabeçalho e coluna de nome fixos ao rolar (estilo planilha).
Fins de semana ficam com fundo diferente e feriados aparecem
destacados. Duas colunas de resumo por colaborador:

- **Restante no mês** — quanto ainda falta trabalhar para bater a meta
  do mês inteiro (nunca fica negativo; se já bateu a meta, mostra 0h).
- **Banco de horas** — a mesma métrica de crédito/débito do resumo
  pessoal (trabalhado vs. esperado até hoje).

## Calendário (feriados, recesso e aniversários)

Menu "Calendário" na sidebar, visível para qualquer colaborador logado
(informativo — não é restrito a Admin). Uma grade de calendário de
verdade — visões **Mês**, **Semana** e **Dia**, navegação com as setas
e um botão **Hoje** que volta pro dia atual — com feriados, recesso e
aniversários da equipe marcados direto no dia certo (chip colorido por
tipo; na visão Mês, clicar num dia abre a visão Dia daquela data pra
ler o nome completo). Sem visão "Agenda" (lista cronológica) por ora.

**Dados fixos no front-end, não no Supabase** — feriados e aniversários
mudam raramente (uma vez por ano, ou quando alguém entra/sai da
equipe), então ficam direto em
[assets/js/calendar-data.js](assets/js/calendar-data.js) em vez de numa
tabela do banco. Vantagem: o Calendário carrega instantâneo, sem
depender de rede, e não precisa rodar SQL nenhum pra isso. Desvantagem:
pra adicionar/corrigir uma data, é preciso editar esse arquivo e
comitar/dar deploy, em vez de só rodar um `insert` no SQL Editor.

**Feriados** (`HOLIDAYS`): nacionais fixos + móveis (Carnaval,
Sexta-feira Santa e Corpus Christi, calculados a partir da Páscoa de
cada ano) + o recesso de fim de ano combinado: **19/12/2026 a
04/01/2027**. Esses dias **não contam como esperado** no cálculo de
horas/banco de horas do módulo Ponto, mesmo caindo num dia da semana em
que o colaborador normalmente trabalha (ver `expectedMinutes` em
`assets/js/ponto-store.js`) — tanto no resumo pessoal quanto na
planilha mensal do admin, onde o dia aparece marcado com 🔸 e uma cor
diferente. **Não inclui** feriados municipais específicos de Goiânia
(ex.: aniversário da cidade) — sem certeza da data exata, para não
arriscar um cálculo de horas errado; se você souber qual é, me avisa
que eu adiciono.

**Aniversários** (`BIRTHDAYS`, mês/dia sem ano — repete todo ano,
então aparece igual em 2026 e 2027): Victor (23/01), Veronica (05/01),
João Marcelo (18/03), Brithany (21/05), Ramon (17/05), Thainara
(13/06), Nathan (26/07), Felibe (05/08), Lara (31/08), Marina (08/10),
Carol (27/10), Vinicius (10/11), Ana Paula (22/12). São puramente
informativos — **não entram** no cálculo de horas esperadas (só
`HOLIDAYS` afeta isso).

## Roadmap

Para deixar de ser um protótipo e virar um produto vendável, falta:

- [x] Banco de dados (Supabase — os usuários não vivem mais só no navegador)
- [x] Registro de ponto com banco de horas (módulo Ponto, ver acima)
- [ ] Autenticação real (Supabase Auth ou backend próprio, com hash de senha e sessão/token)
- [ ] Apertar as policies de RLS depois que houver autenticação (hoje a `anon key` tem acesso total)
- [ ] Validação de e-mail único e regras de permissão reforçadas no servidor
- [x] Correção manual de ponto (adicionar/editar/excluir batidas)
- [x] Justificativa obrigatória ao solicitar uma correção
- [x] Correção de colaborador vira solicitação pendente — só aplica em `time_punches` quando o admin aprova
- [x] Calendário de feriados/recesso, com exclusão automática do cálculo de horas
- [x] Aniversários da equipe no Calendário (informativo, não afeta cálculo de horas)
- [ ] Feriado municipal de Goiânia (se houver um específico) — não incluído por falta de certeza da data
- [ ] Feriados/aniversários hoje são fixos em `calendar-data.js` (decisão deliberada — ver seção Calendário); se um dia isso precisar ser editado sem deploy, mover para uma tabela do Supabase
- [ ] Fotos de perfil no Supabase Storage em vez de base64 na tabela
- [ ] Variáveis de ambiente/build para a config do Supabase, em vez de valores fixos em `supabase-client.js`
- [ ] Correções feitas pelo admin (pela planilha) não deixam rastro — só as do próprio colaborador viram justificativa
- [ ] Testes automatizados (pelo menos do fluxo de login, CRUD de usuários e ponto)
- [ ] Pipeline de deploy (CI/CD)
