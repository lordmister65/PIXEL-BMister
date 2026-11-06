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

## Atualizações V1.1 e V1.2

- **Autosave**: guarda o projeto localmente no navegador e recupera ao reabrir. Use Salvar para baixar uma cópia JSON de segurança.
- **Importar PNG**: importa imagem PNG como uma nova camada no frame atual, recortando ao tamanho do canvas quando a imagem é maior. Não altera resolução automaticamente.
- **Seleção**: arraste para selecionar. Arraste dentro de uma seleção para mover os pixels da camada ativa. Copie (Ctrl+C), recorte (Ctrl+X), cole (Ctrl+V), apague (Delete), ou use os botões abaixo do canvas. Ctrl+V é a área copiada internamente no editor; não lê a área de transferência do sistema.
- **Transformações**: espelhar horizontal/verticalmente a seleção ou a camada inteira.
- **Formas**: retângulos e elipses, com opção de preenchimento.
- **Desenho simétrico**: espelhamento horizontal ao desenhar.
- **Cores**: roda de matiz e quadro de saturação/brilho, HEX e RGB.

## Observações

- O botão **Salvar** baixa um arquivo de projeto JSON no dispositivo: não há armazenamento remoto.
- O botão **Exportar PNG** exporta **apenas o frame atual**; não exporta GIF nem spritesheet.
- O movimento e as transformações afetam apenas a camada selecionada, não múltiplas camadas simultaneamente.
- Camadas são compartilhadas por estrutura dentro de cada frame: cada frame tem sua própria lista de camadas e pixels.
- O autosave utiliza o armazenamento local do navegador, sujeito às cotas e à limpeza de dados pelo usuário. Recomenda-se salvar o projeto periodicamente em JSON.

## Stack

HTML5 Canvas, CSS3 e JavaScript (sem bibliotecas).
