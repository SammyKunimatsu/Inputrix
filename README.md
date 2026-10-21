<div align="center">
  <img src="assets/icon.png" alt="Inputrix Logo" width="110" height="110" />
  <h1>Inputrix</h1>
  <p><strong>Console de Automação de Hardware de Baixo Nível (Teclado & Mouse) para Windows</strong></p>
  <p>
    <a href="https://github.com/SammyKunimatsu/Inputrix/releases/latest"><img src="https://img.shields.io/badge/version-1.0.1-3B82F6?style=flat-square" alt="Version 1.0.1" /></a>
    <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0B0F17?style=flat-square" alt="Platform Windows" />
    <img src="https://img.shields.io/badge/stack-Electron%20%2B%20TypeScript%20%2B%20Win32%20Engine-10B981?style=flat-square" alt="Tech Stack" />
  </p>
  <p>
    <a href="https://github.com/SammyKunimatsu/Inputrix/releases/latest"><strong>⬇️ Baixar Instalador (GitHub Releases)</strong></a>
    &nbsp;•&nbsp;
    <a href="https://github.com/SammyKunimatsu/Inputrix/releases/download/v1.0.1/Inputrix-Setup-1.0.1.exe"><strong>Download Direto (Inputrix-Setup-1.0.1.exe)</strong></a>
  </p>
</div>

---

## Visão Geral

O **Inputrix** é uma estação de automação de entradas físicas de teclado e mouse projetada para Windows. Ao contrário de automatizadores convencionais que utilizam eventos sintéticos de alto nível facilmente ignorados por jogos e aplicações DirectInput, o Inputrix opera diretamente sobre a API `user32.dll` (`SendInput` com `KEYEVENTF_SCANCODE`), emulando sinais reais de hardware com proteção anti-colisão.

---

## 📥 Download & Instalação (Usuários)

Você não precisa compilar o código nem instalar nada extra para usar o Inputrix. Basta baixar o instalador oficial diretamente na página de **Releases**:

1. Acesse a página oficial de [**Releases do Inputrix**](https://github.com/SammyKunimatsu/Inputrix/releases/latest) (ou clique aqui para [**Baixar o Inputrix-Setup-1.0.1.exe diretamente**](https://github.com/SammyKunimatsu/Inputrix/releases/download/v1.0.1/Inputrix-Setup-1.0.1.exe)).
2. Execute o instalador **`Inputrix-Setup-1.0.1.exe`** e escolha o diretório de instalação *(caso apareça o aviso do Windows SmartScreen, clique em **Mais informações** → **Executar assim mesmo**)*.
3. **Motor Nativo Incluso**: A partir da versão `1.0.1`, o motor de baixo nível `Win32` (`engine.exe`) já vem compilado e embutido dentro do instalador — **não é necessário ter Python instalado no computador**.
4. **Atualizações Automáticas**: Todas as novas versões estáveis (ou Beta, caso você ative a opção **Beta Tester** em *Configurações*) são baixadas e instaladas diretamente por dentro do aplicativo com 1 clique.

---

## Principais Funcionalidades

- **Fila Multi-Teclas Independente (`ScanCode`)**:
  - Adicione quantas teclas quiser na fila, cada uma com seu próprio intervalo (`ms`, `s`, `m`, `h`).
  - **Modo Segurar + Esperar**: Configure uma tecla para ficar pressionada continuamente por um tempo específico, soltar e aguardar o tempo de espera antes de repetir o ciclo.
  - **Proteção Anti-Colisão**: Escalonamento automático de `65ms` entre teclas que coincidem no mesmo instante para garantir 100% de registro em jogos e aplicações pesadas.
- **Auto Clicker de Hardware (Mouse)**:
  - Suporte aos botões **Esquerdo**, **Direito** e **Meio (Scroll)**.
  - Modos **Clique Simples**, **Clique Duplo** e **Segurar Botão + Esperar**.
  - Atuação na posição atual do cursor ou em **Coordenadas Fixas (`X, Y`)** com capturador global (`F8`).
  - **Proteção Inteligente de Janela**: O Auto Click pausa automaticamente enquanto o cursor estiver sobre a janela do Inputrix ou sobre o HUD Miniatura.
- **HUD Miniatura Flutuante (`Always-on-Top`)**:
  - Janela compacta e arrastável que exibe contadores regressivos em tempo real (`80ms` de taxa de atualização), cliques realizados, tempo ativo e ciclos restantes.
  - Controle deslizante de opacidade (`25%` a `100%`).
- **Gerenciador de Perfis (Saves)**:
  - Salve, carregue e exclua configurações completas de teclas e mouse com apenas um clique.
- **Bandeja do Sistema (System Tray) & Notificações**:
  - Ao fechar a janela, o Inputrix continua executando silenciosamente em segundo plano na bandeja do Windows, enviando notificações nativas ao iniciar ou parar ciclos.
- **Sistema de Atualização Automática Integrado (Estável & Beta)**:
  - Verifica novas versões diretamente nos [**Releases do GitHub**](https://github.com/SammyKunimatsu/Inputrix/releases), baixa o instalador dentro do próprio aplicativo com barra de progresso e executa a atualização automaticamente.
  - Opção para participar do canal **Beta Tester** (recebendo versões `Pre-release` antecipadas) ou permanecer apenas no canal **Estável**.

---

## Arquitetura do Projeto

O código-fonte é escrito em **TypeScript** e organizado de forma modular dentro de `src/`:

```text
Inputrix/
├── assets/                  # Ícones (.png, .ico) e artes do instalador NSIS (.bmp)
├── build/                   # Script de customização do instalador Windows (installer.nsh)
├── scripts/                 # Scripts utilitários de build (cópia de assets HTML/CSS/Python)
├── src/
│   ├── engine/
│   │   └── engine.py        # Motor Python Win32 (SendInput, Hardware ScanCodes e Telemetria)
│   ├── main/
│   │   ├── main.ts          # Processo Principal Electron (Janelas, Tray, IPC, Persistência)
│   │   └── updater.ts       # Cliente Auto-Updater integrado ao GitHub Releases (Stable/Beta)
│   ├── preload/
│   │   └── preload.ts       # Ponte segura ContextBridge entre Main e Renderer
│   └── renderer/
│       ├── index.html       # Interface principal (Data-Terminal UI Dark/Light)
│       ├── overlay.html     # Interface do HUD Miniatura flutuante
│       ├── styles.css       # Sistema de design completo (Geist Sans + JetBrains Mono)
│       ├── renderer.ts      # Lógica da interface principal, perfis e auto-update
│       └── overlay.ts       # Lógica de telemetria em tempo real da miniatura
├── package.json             # Manifesto do app, scripts e configuração do electron-builder
└── tsconfig.json            # Configuração do compilador TypeScript
```

---

## Como Executar em Desenvolvimento

### Pré-requisitos
- **Windows 10 ou 11**
- **Node.js 18+**
- **Python 3.8+** instalado no PATH do sistema

### Passos

1. Clone o repositório e instale as dependências:
   ```bash
   git clone https://github.com/SammyKunimatsu/Inputrix.git
   cd Inputrix
   npm install
   ```

2. Compile o TypeScript e inicie o aplicativo:
   ```bash
   npm start
   ```

---

## Gerando o Instalador (Setup `.exe`)

Para compilar o código TypeScript e empacotar o instalador customizado NSIS para Windows:

```bash
npm run dist:win
```

O instalador final (`Inputrix-Setup-1.0.0.exe`) será gerado na pasta `release/`, pronto para ser anexado em uma [**Release do GitHub**](https://github.com/SammyKunimatsu/Inputrix/releases) para alimentar o sistema de atualização automática.

---

## Licença

Distribuído sob a licença **MIT**. Desenvolvido por [SammyKunimatsu](https://github.com/SammyKunimatsu).
