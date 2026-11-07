# PIXEL-BMister

Editor de pixel art moderno, desenvolvido em **HTML, CSS e JavaScript puro**. Interface dark mode, canvas em grade, ferramentas, camadas e frames de animação.

## Funcionalidades

- Lápis, borracha, balde de tinta, conta-gotas, linha, retângulo e seleção visual.
- Controle de cor HEX/RGB, seletor de cor e paleta PICO-8 estendida.
- Camadas independentes com visibilidade, nomes editáveis e opacidade.
- Linha do tempo com adição, exclusão, duplicação, tags (Idle/Run/Attack), Onion Skin e reprodução configurável em FPS.
- Zoom, grade, espessura do pincel, desfazer/refazer.
- Exportação do frame atual em PNG sem escala e com transparência, spritesheet PNG + JSON, e GIF animado.
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

## V1.6 — Física, colisão e câmera no Game Lab

- Três mapas maiores com plataformas sólidas: Estúdio, Floresta e Noturno.
- Câmera lateral acompanhando o personagem, mantendo os limites do cenário.
- Física de plataforma: gravidade, pulo com acionamento por tecla, aterrissagem e colisões nas laterais/na base de plataformas.
- Reaparecimento automático quando o personagem cai abaixo do cenário; botão Reiniciar retorna ao começo do mapa.
- Propriedades ajustáveis no preview: gravidade, força de pulo, velocidade e escala.
- Indicador X/Y e retângulo visual de colisão do jogador para depuração.
- Metadados dos pacotes Unity/Godot incluem a física e a geometria do mapa de teste como referência, mas ainda não produzem cenas/colliders prontos nas engines.
- Hospedagem estática Render preservada: `game-physics.js` roda inteiramente no navegador.

Os testes incluem casos de aterrissagem, pulo, colisão lateral, limites horizontais, respawn e câmera.

## V1.5 — Modo Desenvolvedor de Jogos (Game Lab)

Abra o botão **🎮 Modo Desenvolvedor** na barra superior do editor. Uma janela independente permite testar o sprite como personagem em uma cena 2D, sem alterar seus pixels no projeto.

- **Movimentação**: A/D ou setas; **pulo**: espaço; **ataque**: J. Os botões na tela também permitem controlar pelo toque.
- **Animações**: escolha a tag de frames correspondente a Idle, Run, Jump e Attack. Quando não há tags, usa todos os frames; tags configuradas na linha do tempo aparecem automaticamente no preview.
- **Cenários**: estúdio, floresta e noturno; controles de escala visual e velocidade de deslocamento.
- **Atualização de sprites**: o botão *Atualizar sprites* lê novamente os frames do editor, inclusive após edição ou alterações na linha do tempo.
- **Exportação Unity/Godot**: ZIP contendo `spritesheet.png`, `metadata.json` e um guia de importação específico. As animações utilizam índices de frames baseados em zero e os intervalos incluem o frame inicial e final. A exportação **não** gera scripts, cenas, prefabs nem controladores prontos.
- **Hospedagem**: todo o preview e o empacotamento ZIP acontecem no navegador; o Render continua como Static Site.

Os testes de fumaça agora também verificam sintaxe do módulo Game Lab, controles HTML e o formato básico do arquivo ZIP.

## Manutenção V1.4 — estabilidade

- Correção da movimentação de seleções: preserva integralmente o retângulo ao encostar nas bordas; copiar e colar também respeitam os limites do canvas.
- Mesclagem de camadas: agora exige ambas as camadas visíveis, evitando apagar conteúdo oculto inadvertidamente. Revele as camadas antes de mesclar.
- Reprodução: evita recriar todas as miniaturas a cada tick da animação, reduzindo o custo de atualização.
- Gravação: evita salvar snapshots anteriores à edição e grava traços interrompidos (pointercancel).
- Histórico: melhora os nomes das ações (lápis, borracha, formas e seleção) e interrompe o preview ao restaurar um estado.
- Importação: limita JSON a 25 MB, rejeita bytes inválidos e impede exceder o máximo de 100 camadas.
- Testes de fumaça: `node --test tests/smoke.test.cjs` verifica sintaxe, IDs do HTML, geração GIF e configuração Render. O Node é necessário apenas para testes locais — o editor publicado permanece estático.

## Atualização V1.4 — editor profissional

- **Camadas avançadas**: reorganize a ordem com ↑/↓, duplique a camada selecionada e mescle-a com a camada abaixo.
- **Mesclagem**: preserva a composição visível das duas camadas, incorporando opacidade e visibilidade. A camada superior é removida após mesclar e a operação pode ser desfeita.
- **Histórico visual**: painel com até 25 estados recentes exibidos e navegação por clique, além de desfazer/refazer. O buffer em memória mantém até 40 operações; limpar o histórico não apaga o desenho.
- **Aparência do canvas**: alternar fundo quadriculado/transparência para facilitar a inspeção de sprites.
- **Compatibilidade**: projetos JSON das versões anteriores continuam aceitos, com ordem das camadas mantida no salvamento. O histórico de desfazer/refazer é local à sessão e não é incluído no JSON.
- **Render**: nenhuma alteração na configuração `render.yaml`, que continua servindo um site estático.

## Atualização V1.3 — animação

- **Onion Skin**: mostra frames anteriores (azul) e seguintes (rosa) com controle de quantidade e transparência. Não altera os pixels exportados.
- **Tags de animação**: criar, editar e excluir animações por intervalo de frames, como `Idle`, `Walk`, `Attack` e `Jump`. Excluir uma tag **não** exclui seus frames.
- **Preview por animação**: reproduzir apenas os frames da tag selecionada, com opção de loop e FPS configurável.
- **Exportar spritesheet**: gera PNG horizontal com transparência, acompanhada de JSON com coordenadas, dimensões e FPS; o intervalo exportado é a tag atual ou todos os frames.
- **Exportar GIF**: GIF89a animado diretamente no navegador, sem dependências ou backend. A paleta é quantizada em até 255 cores opacas + transparência para compatibilidade com GIF (cores podem diferir do PNG).
- **Projetos**: formato JSON v2 persiste tags e Onion Skin; arquivos JSON v1 continuam compatíveis.
- **Render**: continua como Static Site, sem build de aplicação ou servidor adicional.

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
- O botão **Exportar PNG** exporta **apenas o frame atual**; use os botões **Spritesheet** e **GIF** para exportação da animação completa ou da tag selecionada.
- O movimento e as transformações afetam apenas a camada selecionada, não múltiplas camadas simultaneamente.
- Camadas são compartilhadas por estrutura dentro de cada frame: cada frame tem sua própria lista de camadas e pixels.
- O autosave utiliza o armazenamento local do navegador, sujeito às cotas e à limpeza de dados pelo usuário. Recomenda-se salvar o projeto periodicamente em JSON.

## Stack

HTML5 Canvas, CSS3 e JavaScript (sem bibliotecas).
