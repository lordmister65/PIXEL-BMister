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

## V1.8 — Ferramentas profissionais

Novidades de edição no **Studio Graphite**, sem frameworks ou backend:

- **Pixel Perfect**: ao desenhar com lápis/borracha de 1 px e pincel quadrado, corrige automaticamente cantos extras em trajetórias em formato de L. Ativo por padrão; desative em Propriedades para desenho livre.
- **Pincéis geométricos**: escolha Quadrado, Círculo ou Losango e ajuste a espessura entre 1 e 8 px. O desenho simétrico horizontal continua disponível.
- **Laço (Q)**: desenhe uma região livre para selecionar os pixels internos. **Seleção por cor (W)**: captura pixels da camada ativa com modo Contíguo ou Toda a camada e controle de tolerância.
- **Seleções irregulares**: copiar, recortar, colar, mover, apagar e espelhar preservam a máscara da seleção, inclusive áreas vazias. A seleção retangular (M) dispõe de alças nos quatro cantos para redimensionar pixels pelo método *nearest neighbor*.
- **Bloqueio de camadas**: use o ícone de cadeado discreto ao lado do nome da camada. Camadas bloqueadas não podem ser desenhadas, apagadas, coladas, movidas, espelhadas, mescladas ou excluídas até serem desbloqueadas. Podem continuar sendo selecionadas para consulta.
- **Persistência**: o projeto JSON v3 inclui `locked` por camada; JSONs de versões anteriores (sem essa propriedade) abrem com as camadas desbloqueadas. Undo/redo preserva o estado de bloqueio.
- **Testes**: `node --test tests/smoke.test.cjs` ganhou casos de geometria de pincéis, Pixel Perfect, seleção por cor, máscara de laço e compatibilidade do Render.
- **CI GitHub Actions**: o workflow `.github/workflows/smoke.yml` executa a suíte de testes com Node.js a cada push e pull request na branch `main`. Isso não afeta o build nem o serviço estático do Render.
- **Render**: `render.yaml` continua sem alterações; `professional-tools.js` é carregado antes de `app.js` sem dependências externas.

Observação: o redimensionamento é por alças dos cantos da caixa delimitadora, não uma transformação livre com rotação; a seleção por cor atua sobre a **camada ativa**, e não sobre a composição de todas as camadas.

## V1.7 — Studio UX: produtividade e navegação

A interface Studio Graphite recebeu melhorias de experiência sem remover as funções anteriores:

- **Cabeçalho simplificado**: menus `Arquivo` (Salvar JSON, Abrir JSON, Importar PNG) e `Exportar` (PNG, Spritesheet, GIF). Game Lab permanece em um botão separado.
- **Painéis recolhíveis**: ocultar a barra de ferramentas no botão ☰; ocultar o inspetor na seta superior ou no ícone ▤ junto aos controles do canvas. O botão ▤ continua disponível para restaurar o painel.
- **Painel ajustável**: arraste a divisória entre o canvas e o inspetor para larguras de 220 a 480 px (desktop). Também é possível ajustar com as setas esquerda/direita quando a divisória recebe foco.
- **Modo sem distrações**: clique no ícone ⛶ no cabeçalho ou pressione **Shift+D** para ocultar timeline, ferramentas e inspetor. Pressione **Esc** ou o ícone novamente para sair. **Tab** continua reservado à navegação acessível.
- **Navegação no canvas**: use **Espaço + arrastar** ou o **botão do meio** do mouse para mover a área de desenho; **roda do mouse** para zoom de 200% a 4000%; botão ◎ para centralizar e ⤢ para ajustar à janela.
- **Responsividade**: menus e controles essenciais acessíveis também em telas pequenas.
- **Compatibilidade**: os dados do projeto e o autosave continuam no mesmo formato. O modo de desenho e a exportação Unity/Godot não foram modificados.
- **Render**: site estático sem alteração de `render.yaml`. Arquivos adicionais usam apenas HTML, CSS e JavaScript locais.

Os novos testes de fumaça verificam referências de controles, menus, painéis e a preservação do deploy estático. A qualidade visual e o comportamento dos ponteiros ainda devem ser conferidos num navegador real.

## Novo visual — Studio Graphite (referência minimalista escura)

A interface usa um novo tema inspirado na segunda referência escolhida: fundos pretos/grafite, painéis cinza carvão, acentos lilás acinzentado discretos e ausência de brilhos neon. O design é carregado a partir de `studio-theme.css` após o CSS base e `studio-ui.js` adiciona navegação por âncoras nos painéis do inspetor.

- Editor central escuro com fundo de transparência quadriculado e grade discreta.
- Barra de ferramentas compacta, cabeçalho limpo e controles de exportação preservados.
- Timeline, camadas, paleta e histórico com elementos neutros e estados ativos discretos.
- Painel direito com navegação visual para Propriedades, Paleta e Histórico.
- O Game Lab, as animações e as exportações permanecem disponíveis; nenhuma alteração no formato JSON foi necessária.
- `render.yaml` permanece configurado como Static Site. Não há backend ou dependências adicionais.
- Consulte `node --test tests/smoke.test.cjs` para os testes de integração básicos.

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
