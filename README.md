# Norte Agro Projetos — Acesso

Tela de login e gestão de usuários com a identidade visual da Norte Agro
Projetos (regularização de imóveis rurais). Suporta modo claro/escuro,
menu lateral recolhível e visualização de usuários em grade ou lista.

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
├── index.html                    # estrutura da página (login, sidebar, grid, modal)
├── assets/
│   ├── css/
│   │   └── styles.css            # todo o visual: tokens de cor, tema claro/escuro, layout
│   └── js/
│       ├── supabase-client.js    # conexão com o Supabase (URL + anon key)
│       ├── theme.js              # alternância de tema claro/escuro
│       ├── users-store.js        # camada de dados (hoje: Supabase)
│       └── app.js                # lógica de UI: views, grid, modal, login, sidebar
├── supabase/
│   └── schema.sql                # schema da tabela users + policies de RLS
├── .gitignore
└── README.md
```

`users-store.js` existe separado de propósito: é o único lugar que
sabe que os dados vêm do Supabase. Se um dia trocar de provedor de
banco ou ganhar um backend próprio, só esse arquivo precisa mudar — o
resto da UI (`app.js`) não muda.

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

Como os dados agora vêm do Supabase, é preciso **conexão com a
internet** e que a tabela já exista no banco — rode
[supabase/schema.sql](supabase/schema.sql) no SQL Editor do projeto
Supabase antes de abrir a página pela primeira vez.

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

## Roadmap

Para deixar de ser um protótipo e virar um produto vendável, falta:

- [x] Banco de dados (Supabase — os usuários não vivem mais só no navegador)
- [ ] Autenticação real (Supabase Auth ou backend próprio, com hash de senha e sessão/token)
- [ ] Apertar as policies de RLS depois que houver autenticação (hoje a `anon key` tem acesso total)
- [ ] Validação de e-mail único e regras de permissão reforçadas no servidor
- [ ] Fotos de perfil no Supabase Storage em vez de base64 na tabela
- [ ] Variáveis de ambiente/build para a config do Supabase, em vez de valores fixos em `supabase-client.js`
- [ ] Testes automatizados (pelo menos do fluxo de login e CRUD de usuários)
- [ ] Pipeline de deploy (CI/CD)
