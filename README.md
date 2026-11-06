# PIXEL-BMister

Editor de pixel art moderno, desenvolvido em **HTML, CSS e JavaScript puro**. Interface dark mode, canvas em grade, ferramentas, camadas e frames de animação.

## Funcionalidades

- Lápis, borracha, balde de tinta, conta-gotas, linha, retângulo e seleção visual.
- Controle de cor HEX/RGB, seletor de cor e paleta PICO-8 estendida.
- Camadas independentes com visibilidade, nomes editáveis e opacidade.
- Linha do tempo de animação com adição, exclusão, duplicação e reprodução configurável em FPS.
- Zoom, grade, espessura do pincel, desfazer/refazer.
- Exportação do frame atual em PNG sem escala e com transparência.
- Salvar e abrir projetos em JSON (inclui frames e camadas).
- Atalhos de teclado e interface adaptável.

## Executar localmente

Abra `index.html` em um navegador moderno ou execute com um servidor HTTP local, por exemplo:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Hospedar no Render

O arquivo `render.yaml` permite implantar via **Blueprint**.

1. No [Render Dashboard](https://dashboard.render.com), escolha **New > Blueprint**.
2. Conecte o repositório `lordmister65/PIXEL-BMister`.
3. Confirme o serviço estático e implante.

Alternativamente, escolha **New > Static Site**, selecione o repositório, use **Build Command:** `echo "Static site ready"` e **Publish Directory:** `.`.

Não há necessidade de Node.js, banco de dados ou variáveis de ambiente. A publicação acompanha novos commits na branch `main`.

## Observações

- O botão **Salvar** baixa um arquivo de projeto JSON no dispositivo: não há armazenamento remoto.
- O botão **Exportar PNG** exporta **apenas o frame atual**; não exporta GIF nem spritesheet.
- A ferramenta **Seleção** exibe uma área de seleção, mas ainda não possui recorte/movimentação.
- Camadas são compartilhadas por estrutura dentro de cada frame: cada frame tem sua própria lista de camadas e pixels.
- Recomenda-se salvar o projeto periodicamente em JSON.

## Stack

HTML5 Canvas, CSS3 e JavaScript (sem bibliotecas).
