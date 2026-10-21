(() => {
  const winApi = (window as any).api
  const $ = (id: string) => document.getElementById(id) as any

  let lastItemCount = -1

  const twoDigits = (n: number) => (n < 10 ? `0${n}` : `${n}`)

  const formatClock = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${twoDigits(h)}:${twoDigits(m)}:${twoDigits(s)}`
  }

  const formatCountdown = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    if (m < 60) return `${m}m ${twoDigits(s)}s`
    const h = Math.floor(m / 60)
    return `${h}h ${twoDigits(m % 60)}m`
  }

  const syncOverlayHeight = (itemCount: number) => {
    if (itemCount === lastItemCount) return
    lastItemCount = itemCount
    if (itemCount === 0) {
      winApi.resizeOverlay(96)
      return
    }
    const rows = Array.from($('hudList').children) as HTMLElement[]
    const rowsHeight = rows.reduce((sum, el) => sum + el.offsetHeight, 0)
    const gaps = Math.max(0, rows.length - 1) * 8
    const needed = Math.min(440, 34 + 20 + rowsHeight + gaps)
    winApi.resizeOverlay(needed)
  }

  $('rngHudOpacity').addEventListener('input', (e: any) => winApi.setOverlayOpacity(e.target.value))
  $('btnCloseHud').addEventListener('click', () => winApi.windowControl('close-overlay'))

  document.documentElement.addEventListener('mouseenter', () => winApi.setHoverState('overlay', true))
  document.documentElement.addEventListener('mouseleave', () => winApi.setHoverState('overlay', false))

  winApi.onThemeChanged((theme: string) => {
    document.documentElement.setAttribute('data-theme', theme)
  })

  const renderTelemetry = (data: any) => {
    $('hudUptime').textContent = formatClock(data.uptimeMs || 0)
    const list = $('hudList')
    const keys = data.keys || []
    const mouse = data.mouse
    const totalItems = keys.length + (mouse ? 1 : 0)

    if (totalItems === 0) {
      list.innerHTML = '<div class="hud-empty">Aguardando execução (F6 / F7)</div>'
      syncOverlayHeight(0)
      return
    }

    let html = ''
    for (const k of keys) {
      const pct = Math.max(0, Math.min(100, 100 - Math.round((k.remainingMs / Math.max(1, k.intervalMs)) * 100)))
      const leftTxt = k.leftCount !== null && k.leftCount !== undefined ? ` · faltam ${k.leftCount}` : ''
      const isHold = k.actionMode === 'hold_cycle'
      const phaseTxt = isHold ? (k.phase === 'holding' ? 'Segurando ' : 'Espera ') : ''
      html += `
        <div class="hud-row">
          <div class="hud-row-top">
            <span class="hud-name">Tecla: ${k.label}</span>
            <span class="hud-timer mono">${phaseTxt}${formatCountdown(k.remainingMs)}</span>
          </div>
          <div class="hud-row-sub">
            <span>${k.count} disparos${leftTxt}</span>
            <span>Ciclo ${formatCountdown(k.intervalMs)}</span>
          </div>
          <div class="hud-bar-track"><div class="hud-bar-fill" style="width:${pct}%"></div></div>
        </div>
      `
    }

    if (mouse) {
      const btnNames: Record<string, string> = { left: 'Mouse Esq.', right: 'Mouse Dir.', middle: 'Mouse Meio' }
      const pct = mouse.paused ? 0 : Math.max(0, Math.min(100, 100 - Math.round((mouse.remainingMs / Math.max(1, mouse.intervalMs)) * 100)))
      const leftTxt = mouse.leftCount !== null && mouse.leftCount !== undefined ? ` · faltam ${mouse.leftCount}` : ''
      const isHold = mouse.clickType === 'hold_cycle'
      const phasePrefix = isHold ? (mouse.phase === 'holding' ? 'Segurando ' : 'Espera ') : ''
      const timerTxt = mouse.paused ? 'Pausado' : `${phasePrefix}${formatCountdown(mouse.remainingMs)}`
      html += `
        <div class="hud-row">
          <div class="hud-row-top">
            <span class="hud-name">${btnNames[mouse.button] || 'Mouse'}</span>
            <span class="hud-timer mono">${timerTxt}</span>
          </div>
          <div class="hud-row-sub">
            <span>${mouse.count} cliques${leftTxt}</span>
            <span>Ciclo ${formatCountdown(mouse.intervalMs)}</span>
          </div>
          <div class="hud-bar-track"><div class="hud-bar-fill" style="width:${pct}%"></div></div>
        </div>
      `
    }

    list.innerHTML = html
    syncOverlayHeight(totalItems)
  }

  winApi.onEngineEvent((data: any) => {
    if (data.event === 'telemetry') renderTelemetry(data)
  })
})()
