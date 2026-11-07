# Homologação PIXEL-BMister V2.0

**Data:** 06/11/2026  
**Ramo:** `main`  
**Interface:** Studio Graphite  
**Hospedagem:** Render Static Site (`render.yaml` preservado)

## Escopo validado automaticamente

O GitHub Actions executa dois conjuntos de verificações a cada commit:

### 1. Testes estáticos e regressão (Node.js)

`node --test tests/smoke.test.cjs`

- Sintaxe JavaScript e existência dos arquivos do editor.
- IDs de interface, acessibilidade básica e ordem de carregamento.
- Utilitários de pincéis, Pixel Perfect, máscaras de seleção e laço.
- Estrutura de projetos e modelos, camada bloqueada, GIF, ZIP e física.
- Navegação de frames sem reconstrução completa da timeline.
- Configuração de publicação Render como site estático.

### 2. Testes no navegador Chromium (Playwright)

`node --test tests/browser.test.cjs`

- Inicialização, tela de projetos e abertura de um modelo 16×16.
- Desenho real no canvas com ponteiro.
- Desfazer e refazer, conferindo o conteúdo do pixel.
- Seleção por cor, copiar e colar pixels em outra coordenada.
- Bloqueio de camada impedindo desenho.
- Exportação PNG via download do navegador.
- Salvamento em IndexedDB, recarga da página e recuperação do desenho.
- Modelo de animação com oito frames.
- Abertura do Game Lab, tecla de movimentação e exportação ZIP para Godot.
- Exportação GIF e verificação de assinatura GIF89a.
- Ausência de exceções JavaScript inesperadas no console durante o cenário.

O teste salva `tests/studio-v2-homologation.png` durante o CI, disponível nos artefatos da execução em GitHub Actions.

## Problemas corrigidos durante a homologação

1. **Camadas inacessíveis por teclado:** linhas de camadas agora recebem foco e respondem a Enter/Espaço.
2. **Captura de ponteiro na seleção por cor:** a ferramenta libera a captura após a seleção instantânea, evitando retenção indevida do ponteiro.
3. **Cobertura insuficiente de integração:** adicionado teste real em Chromium para fluxos completos de usuário, e workflow específico no CI.

## Verificações antes de liberar para usuários externos

Mesmo com a suíte automatizada aprovada, execute também um checklist manual na URL publicada no Render:

- [ ] Criar um projeto, desenhar com mouse, toque ou caneta (quando disponível).
- [ ] Verificar zoom e movimentação do canvas em diferentes resoluções.
- [ ] Testar PNG, JSON, spritesheet, GIF e ZIP em arquivos reais.
- [ ] Abrir e fechar o Game Lab, pular, atacar, alterar mapas e parâmetros físicos.
- [ ] Confirmar a persistência após reiniciar o navegador e abrir nova aba.
- [ ] Testar mobile, Firefox e Safari; a automação atual cobre somente Chromium desktop.
- [ ] Conferir cores, texto, foco visível, zoom de página e leitores de tela.
- [ ] Confirmar que o Render concluiu o deploy da revisão `main` mais recente.

**Limite:** os testes não garantem ausência total de bugs, não cobrem todos os tamanhos de projeto e não demonstram, por si só, que o Render publicou a última revisão.

## Executar localmente

```bash
node --test tests/smoke.test.cjs
npm install --no-save --no-package-lock playwright@1.57.0
npx playwright install chromium
node --test tests/browser.test.cjs
```

O Playwright é usado apenas para testes. A aplicação de produção permanece sem dependências de runtime.
