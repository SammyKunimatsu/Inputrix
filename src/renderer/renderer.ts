(() => {
  const winApi = (window as any).api

  const PRESET_KEYS = [
    { vk: 0x20, label: 'SPACE (Espaço)' },
    { vk: 0x0D, label: 'ENTER (Return)' },
    { vk: 0x09, label: 'TAB' },
    { vk: 0x08, label: 'BACKSPACE' },
    { vk: 0x10, label: 'SHIFT' },
    { vk: 0x11, label: 'CTRL' },
    { vk: 0x12, label: 'ALT' },
    { vk: 0x2E, label: 'DELETE' },
    { vk: 0x2D, label: 'INSERT' },
    { vk: 0x26, label: 'SETA CIMA' },
    { vk: 0x28, label: 'SETA BAIXO' },
    { vk: 0x25, label: 'SETA ESQUERDA' },
    { vk: 0x27, label: 'SETA DIREITA' },
    { vk: 0x45, label: 'Tecla E' },
    { vk: 0x46, label: 'Tecla F' },
    { vk: 0x51, label: 'Tecla Q' },
    { vk: 0x52, label: 'Tecla R' },
    { vk: 0x57, label: 'Tecla W' },
    { vk: 0x41, label: 'Tecla A' },
    { vk: 0x53, label: 'Tecla S' },
    { vk: 0x44, label: 'Tecla D' },
    { vk: 0x31, label: 'Número 1' },
    { vk: 0x32, label: 'Número 2' },
    { vk: 0x33, label: 'Número 3' },
    { vk: 0x34, label: 'Número 4' },
    { vk: 0x70, label: 'F1' },
    { vk: 0x71, label: 'F2' },
    { vk: 0x72, label: 'F3' },
    { vk: 0x73, label: 'F4' },
    { vk: 0x74, label: 'F5' }
  ]

  const $ = (id: string) => document.getElementById(id) as any

  let selectedVk = 0x20
  let selectedKeyLabel = 'SPACE (Espaço)'
  let capturingKey = false
  let capturingHotkeyFor: string | null = null
  let keyRunning = false
  let mouseRunning = false
  let activeSlotIds: string[] = []
  let currentTheme = localStorage.getItem('inputrix_theme') || 'dark'
  let hotkeys: Record<string, string> = { keyToggle: 'F6', mouseToggle: 'F7', pickCoord: 'F8' }
  let keySlots: any[] = []
  let savedProfiles: any[] = []
  let repoUrl = 'https://github.com/SammyKunimatsu/Inputrix'
  let pendingUpdate: any = null

  const applyTheme = (theme: string) => {
    currentTheme = theme === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', currentTheme)
    $('lblTheme').textContent = currentTheme === 'dark' ? 'Tema claro' : 'Tema escuro'
    localStorage.setItem('inputrix_theme', currentTheme)
    winApi.setTheme(currentTheme)
  }

  applyTheme(currentTheme)

  $('btnThemeToggle').addEventListener('click', () => applyTheme(currentTheme === 'dark' ? 'light' : 'dark'))
  $('btnToggleOverlay').addEventListener('click', () => winApi.toggleOverlay())
  $('chkNotifications').addEventListener('change', (e: any) => winApi.setNotifications(e.target.checked))

  winApi.onOverlayState((visible: boolean) => {
    $('btnToggleOverlay').classList.toggle('active', Boolean(visible))
  })

  const openTab = (tabId: string) => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'))
    const navBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`)
    if (navBtn) navBtn.classList.add('active')
    $(tabId).classList.add('active')
  }

  document.querySelectorAll('.nav-btn').forEach((btn: any) => {
    btn.addEventListener('click', () => openTab(btn.dataset.tab))
  })

  $('btnTopUpdateBanner').addEventListener('click', () => openTab('tab-settings'))
  $('btnOpenGitHubTop').addEventListener('click', () => winApi.openExternal(repoUrl))
  $('btnOpenGitHubFooter').addEventListener('click', () => winApi.openExternal(repoUrl))
  $('btnOpenGitHubCard').addEventListener('click', () => winApi.openExternal(repoUrl))
  $('btnOpenReleasesCard').addEventListener('click', () => winApi.openExternal(`${repoUrl}/releases`))

  const selPreset = $('selPresetKey')
  for (const item of PRESET_KEYS) {
    const opt = document.createElement('option')
    opt.value = String(item.vk)
    opt.textContent = `${item.label} — 0x${item.vk.toString(16).toUpperCase()}`
    selPreset.appendChild(opt)
  }

  const updateKeyDisplay = (vk: number, name: string) => {
    selectedVk = vk
    selectedKeyLabel = name
    $('lblCurrentKey').textContent = name
    $('lblKeyMeta').textContent = `Código 0x${vk.toString(16).toUpperCase()} · ScanCode ativo`
    const match = PRESET_KEYS.find((k) => k.vk === vk)
    if (match) selPreset.value = String(vk)
  }

  selPreset.addEventListener('change', (e: any) => {
    const vk = Number(e.target.value)
    const found = PRESET_KEYS.find((k) => k.vk === vk)
    if (found) updateKeyDisplay(found.vk, found.label)
  })

  const syncModeVisibility = () => {
    const isKeyHold = $('selKeyActionMode').value === 'hold_cycle'
    $('cardKeyHoldDuration').classList.toggle('is-hidden', !isKeyHold)
    $('lblKeyIntervalTitle').textContent = isKeyHold ? 'Tempo de espera após soltar a tecla' : 'Cadência do temporizador'

    const isMouseHold = $('selMouseType').value === 'hold_cycle'
    $('cardMouseHoldDuration').classList.toggle('is-hidden', !isMouseHold)
    $('lblMouseIntervalTitle').textContent = isMouseHold ? 'Tempo de espera após soltar o botão' : 'Cadência do temporizador'
  }

  $('selKeyActionMode').addEventListener('change', syncModeVisibility)
  $('selMouseType').addEventListener('change', syncModeVisibility)

  $('btnCaptureKey').addEventListener('click', () => {
    capturingKey = true
    $('btnCaptureKey').classList.add('listening')
    $('lblCurrentKey').textContent = 'Aguardando tecla...'
    $('lblKeyMeta').textContent = 'Pressione qualquer tecla física'
  })

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (capturingKey) {
      e.preventDefault()
      e.stopPropagation()
      capturingKey = false
      $('btnCaptureKey').classList.remove('listening')
      const vk = e.keyCode || 0x20
      const readable = e.code ? `${e.key.toUpperCase()} (${e.code})` : e.key.toUpperCase()
      updateKeyDisplay(vk, readable)
      return
    }

    if (capturingHotkeyFor) {
      e.preventDefault()
      e.stopPropagation()
      const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key
      hotkeys[capturingHotkeyFor] = keyName
      const btn = document.querySelector(`[data-hk="${capturingHotkeyFor}"]`)
      if (btn) {
        btn.textContent = keyName
        btn.classList.remove('listening')
      }
      capturingHotkeyFor = null
      winApi.setHotkeys(hotkeys)
      updateButtonLabels()
    }
  })

  document.querySelectorAll('.hk-btn').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hk-btn').forEach((b) => b.classList.remove('listening'))
      capturingHotkeyFor = btn.dataset.hk
      btn.textContent = '...'
      btn.classList.add('listening')
    })
  })

  const calcIntervalMs = (prefix: string) => {
    const h = Math.max(0, Number($(prefix + 'Hours').value) || 0)
    const m = Math.max(0, Number($(prefix + 'Minutes').value) || 0)
    const s = Math.max(0, Number($(prefix + 'Seconds').value) || 0)
    const ms = Math.max(0, Number($(prefix + 'Ms').value) || 0)
    return Math.max(1, (h * 3600000) + (m * 60000) + (s * 1000) + ms)
  }

  const twoDigits = (n: number) => (n < 10 ? `0${n}` : `${n}`)

  const formatClock = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${twoDigits(h)}:${twoDigits(m)}:${twoDigits(s)}`
  }

  const formatDuration = (totalMs: number) => {
    const parts: string[] = []
    let rem = totalMs
    const h = Math.floor(rem / 3600000)
    rem %= 3600000
    const m = Math.floor(rem / 60000)
    rem %= 60000
    const s = Math.floor(rem / 1000)
    const ms = rem % 1000
    if (h > 0) parts.push(`${h}h`)
    if (m > 0) parts.push(`${m}m`)
    if (s > 0) parts.push(`${s}s`)
    if (ms > 0 || parts.length === 0) parts.push(`${ms}ms`)
    return parts.join(' ')
  }

  const formatCountdown = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m}m ${twoDigits(s)}s`
  }

  const setIntervalInputs = (prefix: string, totalMs: number) => {
    let rem = totalMs
    const h = Math.floor(rem / 3600000)
    rem %= 3600000
    const m = Math.floor(rem / 60000)
    rem %= 60000
    const s = Math.floor(rem / 1000)
    const ms = rem % 1000
    $(prefix + 'Hours').value = h
    $(prefix + 'Minutes').value = m
    $(prefix + 'Seconds').value = s
    $(prefix + 'Ms').value = ms
    refreshTelemetryIntervals()
  }

  const refreshTelemetryIntervals = () => {
    $('statKeyInterval').textContent = `${keySlots.filter((s) => s.enabled).length} ativas`
    $('statMouseInterval').textContent = formatDuration(calcIntervalMs('mouse'))
  }

  const bindPresets = (containerId: string, prefix: string) => {
    const container = $(containerId)
    container.querySelectorAll('button').forEach((btn: any) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('button').forEach((b: any) => b.classList.remove('active'))
        btn.classList.add('active')
        setIntervalInputs(prefix, Number(btn.dataset.ms))
      })
    })
  }

  bindPresets('keyTimePresets', 'key')
  bindPresets('keyHoldPresets', 'keyHold')
  bindPresets('mouseTimePresets', 'mouse')
  bindPresets('mouseHoldPresets', 'mouseHold')

  const timeFields = [
    'keyHours', 'keyMinutes', 'keySeconds', 'keyMs',
    'keyHoldHours', 'keyHoldMinutes', 'keyHoldSeconds', 'keyHoldMs',
    'mouseHours', 'mouseMinutes', 'mouseSeconds', 'mouseMs',
    'mouseHoldHours', 'mouseHoldMinutes', 'mouseHoldSeconds', 'mouseHoldMs'
  ]
  timeFields.forEach((id) => $(id).addEventListener('input', refreshTelemetryIntervals))

  const getRadioVal = (name: string) => {
    const el = document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement | null
    return el ? el.value : 'infinite'
  }

  const buildCurrentSlotObj = () => ({
    id: 'slot-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    enabled: true,
    vk: selectedVk,
    label: selectedKeyLabel,
    actionMode: $('selKeyActionMode').value,
    holdDurationMs: calcIntervalMs('keyHold'),
    intervalMs: calcIntervalMs('key'),
    holdMs: Math.max(5, Number($('numKeyHold').value) || 75),
    jitterMs: Math.max(0, Number($('numKeyJitter').value) || 0),
    repeatMode: getRadioVal('keyRepeatMode'),
    repeatCount: Math.max(1, Number($('numKeyRepeatCount').value) || 1),
    count: 0
  })

  const renderKeySlots = () => {
    const container = $('keySlotList')
    container.innerHTML = ''
    $('lblSlotCount').textContent = keySlots.length
    refreshTelemetryIntervals()

    if (keySlots.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'empty-slots'
      empty.textContent = 'Fila vazia. Defina a tecla e a cadência acima e clique em "Adicionar à fila", ou carregue um perfil salvo.'
      container.appendChild(empty)
      return
    }

    for (const slot of keySlots) {
      const isRunning = activeSlotIds.includes(slot.id)
      const row = document.createElement('div')
      row.className = `slot-item ${isRunning ? 'running' : ''}`

      const loopInfo = slot.repeatMode === 'infinite' ? 'Contínuo' : `${slot.repeatCount} ciclos`
      const jitterInfo = slot.jitterMs > 0 ? ` · ±${slot.jitterMs}ms` : ''
      const isHoldCycle = slot.actionMode === 'hold_cycle'
      const cadenceTxt = isHoldCycle
        ? `Segurar ${formatDuration(slot.holdDurationMs || 1000)} · Esperar ${formatDuration(slot.intervalMs)}`
        : `A cada ${formatDuration(slot.intervalMs)}`
      const paramsTxt = isHoldCycle
        ? `${loopInfo} · Ciclo Segurar/Soltar${jitterInfo}`
        : `${loopInfo} · Hold ${slot.holdMs}ms${jitterInfo}`

      row.innerHTML = `
        <input type="checkbox" class="slot-chk" aria-label="Ativar tecla na fila" ${slot.enabled ? 'checked' : ''} />
        <div class="slot-key-cell">
          <span class="slot-key-name">${slot.label}</span>
          <span class="slot-key-vk">0x${slot.vk.toString(16).toUpperCase()}</span>
        </div>
        <div class="slot-cadence" id="cad-${slot.id}">${cadenceTxt}</div>
        <div class="slot-params">${paramsTxt}</div>
        <div class="slot-right">
          <span class="slot-counter" id="cnt-${slot.id}">${slot.count || 0} pulsos</span>
          <button class="slot-btn ${isRunning ? 'stop' : 'play'}">${isRunning ? 'Parar' : 'Rodar'}</button>
          <button class="slot-btn del" title="Remover da fila" aria-label="Remover da fila">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3.5 4.5H12.5M6 4.5V3H10V4.5M5 4.5V13H11V4.5" stroke="currentColor" stroke-width="1.4" /></svg>
          </button>
        </div>
      `

      row.querySelector('.slot-chk')?.addEventListener('change', (e: any) => {
        slot.enabled = e.target.checked
        refreshTelemetryIntervals()
      })

      row.querySelector('.slot-btn.play, .slot-btn.stop')?.addEventListener('click', () => {
        winApi.sendCommand({ cmd: 'toggle_key_slot', item: slot })
      })

      row.querySelector('.slot-btn.del')?.addEventListener('click', () => {
        if (isRunning) winApi.sendCommand({ cmd: 'toggle_key_slot', item: slot })
        keySlots = keySlots.filter((s) => s.id !== slot.id)
        renderKeySlots()
      })

      container.appendChild(row)
    }
  }

  $('btnAddKeySlot').addEventListener('click', () => {
    keySlots.push(buildCurrentSlotObj())
    renderKeySlots()
  })

  $('btnClearSlots').addEventListener('click', () => {
    winApi.sendCommand({ cmd: 'stop_key' })
    keySlots = []
    $('statKeyCount').textContent = '0'
    $('statUptime').textContent = '00:00:00'
    renderKeySlots()
  })

  const renderSavesSelect = (selectedId = '') => {
    const sel = $('selSavedProfiles')
    sel.innerHTML = '<option value="">Selecionar perfil...</option>'
    for (const p of savedProfiles) {
      const opt = document.createElement('option')
      opt.value = p.id
      opt.textContent = `${p.name} (${(p.keySlots || []).length} teclas)`
      if (p.id === selectedId) opt.selected = true
      sel.appendChild(opt)
    }
  }

  const showUpdateResult = (res: any) => {
    if (res.error) {
      $('lblUpdateStatusText').textContent = `Aviso: ${res.error}`
      return
    }
    if (!res.hasUpdate) {
      $('lblUpdateStatusText').textContent = `Você já está na versão mais recente (v${res.currentVersion}) para o canal selecionado.`
      $('boxUpdateFound').classList.add('is-hidden')
      $('btnTopUpdateBanner').classList.add('is-hidden')
      $('pillUpdateNav').classList.add('is-hidden')
      return
    }

    pendingUpdate = res
    const channelLabel = res.isPrerelease ? 'Beta Tester' : 'Estável'
    $('lblUpdateStatusText').textContent = `Nova versão v${res.latestVersion} (${channelLabel}) encontrada no GitHub Releases!`
    $('lblReleaseTitle').textContent = `${res.releaseName} (v${res.latestVersion})`
    $('lblReleaseChannelBadge').textContent = channelLabel
    $('lblReleaseNotes').textContent = res.releaseNotes || 'Melhorias de desempenho e novos recursos.'
    $('boxUpdateFound').classList.remove('is-hidden')
    $('lblTopUpdateText').textContent = `Atualizar para v${res.latestVersion}`
    $('btnTopUpdateBanner').classList.remove('is-hidden')
    $('pillUpdateNav').textContent = `v${res.latestVersion}`
    $('pillUpdateNav').classList.remove('is-hidden')
  }

  const initApp = async () => {
    savedProfiles = await winApi.getSaves()
    renderSavesSelect()
    const info = await winApi.getAppInfo()
    if (info) {
      repoUrl = info.repoUrl || repoUrl
      const verTxt = `v${info.version}`
      $('lblHeaderVersion').textContent = verTxt
      $('lblFooterVersion').textContent = `Inputrix ${verTxt}`
      $('lblCurrentVerCard').textContent = `Versão atual: ${verTxt}`
      if (info.settings) {
        $('chkBetaChannel').checked = Boolean(info.settings.allowBeta)
        $('chkAutoUpdate').checked = info.settings.autoCheckUpdates !== false
        $('chkNotifications').checked = info.settings.notificationsEnabled !== false
        if (info.settings.theme) applyTheme(info.settings.theme)
      }
    }
  }

  $('chkBetaChannel').addEventListener('change', async (e: any) => {
    const allowBeta = Boolean(e.target.checked)
    await winApi.saveSettings({ allowBeta })
    $('lblUpdateStatusText').textContent = 'Verificando canal selecionado...'
    const res = await winApi.checkForUpdates(allowBeta)
    showUpdateResult(res)
  })

  $('chkAutoUpdate').addEventListener('change', (e: any) => {
    winApi.saveSettings({ autoCheckUpdates: Boolean(e.target.checked) })
  })

  $('btnCheckUpdateNow').addEventListener('click', async () => {
    $('lblUpdateStatusText').textContent = 'Consultando releases no GitHub...'
    const res = await winApi.checkForUpdates($('chkBetaChannel').checked)
    showUpdateResult(res)
  })

  $('btnInstallUpdateNow').addEventListener('click', async () => {
    if (!pendingUpdate) return
    if (!pendingUpdate.downloadUrl) {
      winApi.openExternal(pendingUpdate.htmlUrl || `${repoUrl}/releases`)
      return
    }
    $('btnInstallUpdateNow').disabled = true
    $('btnInstallUpdateNow').textContent = 'Baixando instalador...'
    $('boxUpdateProgress').classList.remove('is-hidden')
    const res = await winApi.installUpdate(pendingUpdate.downloadUrl, pendingUpdate.assetName)
    if (!res.ok) {
      $('btnInstallUpdateNow').disabled = false
      $('btnInstallUpdateNow').textContent = 'Baixar e instalar atualização agora'
      $('lblUpdateStatusText').textContent = `Falha na instalação automática: ${res.error}`
    }
  })

  winApi.onUpdateAvailable((res: any) => showUpdateResult(res))
  winApi.onUpdateProgress((prog: any) => {
    $('boxUpdateProgress').classList.remove('is-hidden')
    $('lblUpdateProgressText').textContent = `Baixando instalador (${prog.recMb} MB / ${prog.totMb} MB)...`
    $('lblUpdateProgressPct').textContent = `${prog.pct}%`
    $('barUpdateProgress').style.width = `${prog.pct}%`
  })

  $('btnSaveProfile').addEventListener('click', async () => {
    const name = $('inpSaveName').value.trim()
    if (!name) return
    if (keySlots.length === 0) keySlots.push(buildCurrentSlotObj())
    const profile = {
      id: 'save-' + Date.now(),
      name,
      keySlots: keySlots.map((s) => ({ ...s, count: 0 })),
      mouseConfig: {
        button: $('selMouseButton').value,
        clickType: $('selMouseType').value,
        posMode: getRadioVal('mousePosMode'),
        x: Number($('numMouseX').value) || 0,
        y: Number($('numMouseY').value) || 0,
        holdDurationMs: calcIntervalMs('mouseHold'),
        intervalMs: calcIntervalMs('mouse'),
        holdMs: Math.max(5, Number($('numMouseHold').value) || 25),
        jitterMs: Math.max(0, Number($('numMouseJitter').value) || 0),
        repeatMode: getRadioVal('mouseRepeatMode'),
        repeatCount: Math.max(1, Number($('numMouseRepeatCount').value) || 1)
      }
    }
    savedProfiles = await winApi.saveProfile(profile)
    const saved = savedProfiles.find((p) => p.name.toLowerCase() === name.toLowerCase())
    renderSavesSelect(saved ? saved.id : '')
    $('inpSaveName').value = ''
  })

  const applyProfile = (profile: any) => {
    if (!profile) return
    winApi.sendCommand({ cmd: 'stop_all' })
    keySlots = (profile.keySlots || []).map((s: any) => ({ ...s, count: 0 }))
    renderKeySlots()
    if (profile.mouseConfig) {
      const mc = profile.mouseConfig
      $('selMouseButton').value = mc.button || 'left'
      $('selMouseType').value = mc.clickType || 'single'
      $('numMouseX').value = mc.x || 0
      $('numMouseY').value = mc.y || 0
      $('numMouseHold').value = mc.holdMs || 25
      $('numMouseJitter').value = mc.jitterMs || 0
      $('numMouseRepeatCount').value = mc.repeatCount || 100
      setIntervalInputs('mouse', mc.intervalMs || 100)
      if (mc.holdDurationMs) setIntervalInputs('mouseHold', mc.holdDurationMs)
      syncModeVisibility()
    }
  }

  $('btnLoadProfile').addEventListener('click', () => {
    const id = $('selSavedProfiles').value
    const found = savedProfiles.find((p) => p.id === id)
    if (found) applyProfile(found)
  })

  $('selSavedProfiles').addEventListener('change', (e: any) => {
    const found = savedProfiles.find((p) => p.id === e.target.value)
    if (found) applyProfile(found)
  })

  $('btnDeleteProfile').addEventListener('click', async () => {
    const id = $('selSavedProfiles').value
    if (!id) return
    savedProfiles = await winApi.deleteProfile(id)
    renderSavesSelect()
  })

  const toggleKeyClicker = () => {
    if (keyRunning) {
      winApi.sendCommand({ cmd: 'stop_key' })
      return
    }
    if (keySlots.length === 0) keySlots.push(buildCurrentSlotObj())
    const enabledItems = keySlots.filter((s) => s.enabled)
    if (enabledItems.length === 0 && keySlots.length > 0) {
      keySlots[0].enabled = true
      enabledItems.push(keySlots[0])
    }
    keySlots.forEach((s) => s.count = 0)
    renderKeySlots()
    winApi.sendCommand({ cmd: 'start_key', items: enabledItems })
  }

  const toggleMouseClicker = () => {
    if (mouseRunning) {
      winApi.sendCommand({ cmd: 'stop_mouse' })
      return
    }
    const config = {
      button: $('selMouseButton').value,
      clickType: $('selMouseType').value,
      posMode: getRadioVal('mousePosMode'),
      x: Number($('numMouseX').value) || 0,
      y: Number($('numMouseY').value) || 0,
      holdDurationMs: calcIntervalMs('mouseHold'),
      intervalMs: calcIntervalMs('mouse'),
      holdMs: Math.max(5, Number($('numMouseHold').value) || 25),
      jitterMs: Math.max(0, Number($('numMouseJitter').value) || 0),
      repeatMode: getRadioVal('mouseRepeatMode'),
      repeatCount: Math.max(1, Number($('numMouseRepeatCount').value) || 1)
    }
    winApi.sendCommand({ cmd: 'start_mouse', config })
  }

  const updateButtonLabels = () => {
    const btnKey = $('btnToggleKey')
    const btnMouse = $('btnToggleMouse')
    btnKey.textContent = keyRunning ? `Parar fila (${hotkeys.keyToggle})` : `Iniciar fila (${hotkeys.keyToggle})`
    btnKey.className = `action-btn ${keyRunning ? 'stop' : 'start'}`
    btnMouse.textContent = mouseRunning ? `Parar mouse (${hotkeys.mouseToggle})` : `Iniciar mouse (${hotkeys.mouseToggle})`
    btnMouse.className = `action-btn ${mouseRunning ? 'stop' : 'start'}`
    $('pillKey').textContent = keyRunning ? `${activeSlotIds.length} ativas` : 'Inativo'
    $('pillKey').className = `status-pill ${keyRunning ? 'running' : ''}`
    $('pillMouse').textContent = mouseRunning ? 'Ativo' : 'Inativo'
    $('pillMouse').className = `status-pill ${mouseRunning ? 'running' : ''}`
  }

  $('btnToggleKey').addEventListener('click', toggleKeyClicker)
  $('btnToggleMouse').addEventListener('click', toggleMouseClicker)
  $('btnStopAll').addEventListener('click', () => winApi.sendCommand({ cmd: 'stop_all' }))
  $('btnPickNow').addEventListener('click', () => winApi.sendCommand({ cmd: 'get_cursor' }))
  $('chkAlwaysOnTop').addEventListener('change', (e: any) => winApi.setAlwaysOnTop(e.target.checked))
  $('btnMin').addEventListener('click', () => winApi.windowControl('min'))
  $('btnMax').addEventListener('click', () => winApi.windowControl('max'))
  $('btnClose').addEventListener('click', () => winApi.windowControl('close'))

  winApi.onHotkeyTriggered((action: string) => {
    if (action === 'keyToggle') toggleKeyClicker()
    else if (action === 'mouseToggle') toggleMouseClicker()
  })

  winApi.onEngineEvent((data: any) => {
    if (data.event === 'status') {
      if (data.mode === 'key') {
        keyRunning = data.running
        activeSlotIds = data.activeIds || []
        renderKeySlots()
      }
      if (data.mode === 'mouse') mouseRunning = data.running
      updateButtonLabels()
    } else if (data.event === 'tick') {
      if (data.mode === 'key') {
        $('statKeyCount').textContent = data.count
        const target = keySlots.find((s) => s.id === data.slotId)
        if (target) target.count = data.slotCount
        const cntEl = $(`cnt-${data.slotId}`)
        if (cntEl) cntEl.textContent = `${data.slotCount} pulsos`
      }
      if (data.mode === 'mouse') $('statMouseCount').textContent = data.count
    } else if (data.event === 'telemetry') {
      $('statUptime').textContent = formatClock(data.uptimeMs || 0)
      if (data.mouse && mouseRunning) $('pillMouse').textContent = data.mouse.paused ? 'Pausado' : 'Ativo'
      for (const k of (data.keys || [])) {
        const cadEl = $(`cad-${k.id}`)
        if (cadEl) {
          const prefix = k.actionMode === 'hold_cycle' ? (k.phase === 'holding' ? 'Segurando' : 'Espera') : 'Próx. em'
          cadEl.textContent = `${prefix}: ${formatCountdown(k.remainingMs)}`
        }
        const cntEl = $(`cnt-${k.id}`)
        if (cntEl) {
          const leftPart = k.leftCount !== null && k.leftCount !== undefined ? ` (faltam ${k.leftCount})` : ''
          cntEl.textContent = `${k.count} pulsos${leftPart}`
        }
      }
    } else if (data.event === 'cursor') {
      $('numMouseX').value = data.x
      $('numMouseY').value = data.y
      $('radPosFixed').checked = true
    }
  })

  renderKeySlots()
  initApp()
})()
