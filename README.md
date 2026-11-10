# Français A1 — Apostila interativa

Abra `index.html` no navegador (duplo clique). Não precisa de servidor, internet ou banco de dados.

## Estrutura
- `index.html` · `style.css` · `script.js` — interface e lógica.
- `data/curso.js` — níveis, unidades e roteiro A2–B2 (Documento B).
- `data/modulos/A1-Uxx-Myy.js` — um arquivo por módulo (seções, exercícios, gabaritos, flashcards).
- `ferramentas/` — scripts Python que converteram o PDF nesses dados (`extract.py` → `build.py`).

## O que o site faz
Painel com progresso e "continuar de onde parou"; navegação por unidade/módulo/seção; seções marcáveis como concluídas;
perguntas de compreensão com caixa de resposta ou seleção de alternativa (salvas); autoavaliações com caixas de marcar; fichas com campos para preencher; exercícios com correção imediata (múltipla escolha, V/F, lacunas, associação, respostas abertas com autoavaliação);
gabarito comentado recolhível e organizado por exercício; traduções ocultáveis; checklist "Je peux…" persistente; flashcards (revisão espaçada,
FR↔PT, áudio pela voz do navegador); revisão de erros; busca sem acentos; anotações por seção; modo claro/escuro;
backup (exportar/importar JSON). Tudo é salvo em `localStorage`.

## Como editar
- Corrigir um texto: abra o arquivo do módulo em `data/modulos/` e edite o campo `x` do bloco.
- Adicionar um módulo: crie `data/modulos/NOVO.js` (mesmo formato), inclua o `<script>` no `index.html` e a unidade em `data/curso.js`.
- Cores e tipografia: variáveis no topo de `style.css`.

## Limitações conhecidas
- A apostila fornecida cobre apenas o nível A1; A2–B2 aparecem como roteiro (Documento B), sem aulas.
- Cerca de 85% dos itens de exercício têm correção automática; os demais exibem o gabarito comentado completo.
- O áudio depende de haver voz francesa instalada no navegador/sistema.
