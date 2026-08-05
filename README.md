# Norte Agro Projetos — Acesso

Tela de login e gestão de usuários com a identidade visual da Norte Agro
Projetos (regularização de imóveis rurais). Suporta modo claro/escuro,
menu lateral recolhível e visualização de usuários em grade ou lista.

## Status atual

Este é um **protótipo de front-end**, sem backend. Serve para validar
fluxo, layout e identidade visual antes de investir em uma versão com
dados reais. Pontos importantes:

- **Sem autenticação real.** O formulário de login aceita qualquer
  usuário/senha preenchidos. O e-mail digitado é comparado com os
  usuários cadastrados apenas para decidir se a sessão é de um
  administrador (e assim liberar o cadastro de novos usuários).
- **Sem persistência real.** Os usuários cadastrados ficam salvos no
  `localStorage` do navegador — não são compartilhados entre
  dispositivos nem sobrevivem a uma limpeza de dados do navegador.
- **Sem senha validada.** Ao criar um usuário, a senha é apenas
  exigida no formulário; ela não é usada para autenticar depois.
- **Foto de perfil sem upload real.** A foto escolhida é lida no
  navegador e guardada como base64 dentro do próprio registro do
  usuário no `localStorage` — não é enviada a lugar nenhum. Cadastrar
  muitas fotos grandes pode esbarrar no limite de armazenamento do
  navegador (geralmente ~5–10 MB no total).

Nenhum desses pontos é um bug — é o estágio esperado de um protótipo
estático. Veja [Roadmap](#roadmap) para o que falta para produção.

## Estrutura do projeto

```
Projeto-em-fases-/
├── index.html              # estrutura da página (login, sidebar, grid, modal)
├── assets/
│   ├── css/
│   │   └── styles.css      # todo o visual: tokens de cor, tema claro/escuro, layout
│   └── js/
│       ├── theme.js        # alternância de tema claro/escuro
│       ├── users-store.js  # camada de dados (hoje: localStorage)
│       └── app.js          # lógica de UI: views, grid, modal, login, sidebar
├── .gitignore
└── README.md
```

`users-store.js` existe separado de propósito: é o único lugar que
sabe que os dados vêm do `localStorage`. Quando houver uma API de
verdade, só esse arquivo precisa mudar (trocar `localStorage` por
`fetch`) — o resto da UI (`app.js`) não muda.

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

## Dados de teste

Três usuários já vêm cadastrados de fábrica (criados na primeira vez
que a página roda em um navegador):

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

- [ ] Backend com autenticação real (hash de senha, sessão/token)
- [ ] Banco de dados (os usuários deixam de viver só no navegador)
- [ ] Validação de e-mail único e regras de permissão no servidor
- [ ] HTTPS e variáveis de ambiente para configuração/segredos
- [ ] Testes automatizados (pelo menos do fluxo de login e CRUD de usuários)
- [ ] Pipeline de deploy (CI/CD)
