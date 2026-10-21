import https from 'https'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { app } from 'electron'

const REPO_OWNER = 'SammyKunimatsu'
const REPO_NAME = 'Inputrix'

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  isPrerelease: boolean
  releaseName: string
  releaseNotes: string
  downloadUrl: string
  assetName: string
  htmlUrl: string
  error?: string
}

const parseSemver = (ver: string) => {
  const clean = ver.replace(/^v/i, '').trim()
  const [core, pre = ''] = clean.split('-', 2)
  const parts = core.split('.').map((n) => Number(n) || 0)
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0, pre }
}

const isNewerVersion = (current: string, candidate: string): boolean => {
  const a = parseSemver(current)
  const b = parseSemver(candidate)
  if (b.major !== a.major) return b.major > a.major
  if (b.minor !== a.minor) return b.minor > a.minor
  if (b.patch !== a.patch) return b.patch > a.patch
  if (!a.pre && b.pre) return false
  if (a.pre && !b.pre) return true
  if (a.pre && b.pre) return b.pre.localeCompare(a.pre, undefined, { numeric: true }) > 0
  return false
}

const fetchJson = (url: string): Promise<any> => new Promise((resolve, reject) => {
  const req = https.get(url, { headers: { 'User-Agent': 'Inputrix-Updater/1.0.0', Accept: 'application/vnd.github+json' } }, (res) => {
    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      fetchJson(res.headers.location).then(resolve).catch(reject)
      return
    }
    let raw = ''
    res.on('data', (chunk) => raw += chunk)
    res.on('end', () => {
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
  })
  req.on('error', reject)
})

export const checkGitHubUpdates = async (currentVersion: string, allowBeta: boolean): Promise<UpdateCheckResult> => {
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`
    const releases = await fetchJson(url)
    if (!Array.isArray(releases) || releases.length === 0) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        isPrerelease: false,
        releaseName: 'Nenhuma release publicada ainda',
        releaseNotes: '',
        downloadUrl: '',
        assetName: '',
        htmlUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`
      }
    }

    const eligible = releases.filter((r: any) => {
      if (r.draft) return false
      const isBeta = Boolean(r.prerelease) || /-(beta|alpha|rc)/i.test(String(r.tag_name || ''))
      return allowBeta ? true : !isBeta
    })

    const target = eligible[0]
    if (!target) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        isPrerelease: false,
        releaseName: 'Nenhuma versão disponível neste canal',
        releaseNotes: '',
        downloadUrl: '',
        assetName: '',
        htmlUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`
      }
    }

    const latestVersion = String(target.tag_name || currentVersion).replace(/^v/i, '')
    const hasUpdate = isNewerVersion(currentVersion, latestVersion)
    const assets = Array.isArray(target.assets) ? target.assets : []
    const exeAsset = assets.find((a: any) => String(a.name || '').toLowerCase().endsWith('.exe')) || assets[0]

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      isPrerelease: Boolean(target.prerelease) || /-(beta|alpha|rc)/i.test(latestVersion),
      releaseName: String(target.name || `Inputrix v${latestVersion}`),
      releaseNotes: String(target.body || 'Melhorias de desempenho e estabilidade.'),
      downloadUrl: exeAsset ? String(exeAsset.browser_download_url || '') : '',
      assetName: exeAsset ? String(exeAsset.name || `Inputrix-Setup-${latestVersion}.exe`) : '',
      htmlUrl: String(target.html_url || `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`)
    }
  } catch (err: any) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      isPrerelease: false,
      releaseName: '',
      releaseNotes: '',
      downloadUrl: '',
      assetName: '',
      htmlUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
      error: err?.message || 'Falha ao consultar GitHub Releases'
    }
  }
}

export const downloadAndRunInstaller = (
  downloadUrl: string,
  assetName: string,
  onProgress: (pct: number, transferredMb: string, totalMb: string) => void
): Promise<{ ok: boolean; error?: string }> => new Promise((resolve) => {
  if (!downloadUrl) {
    resolve({ ok: false, error: 'Nenhum instalador (.exe) anexado nesta release.' })
    return
  }

  const destPath = path.join(os.tmpdir(), assetName || `Inputrix-Setup-${Date.now()}.exe`)

  const followAndDownload = (url: string) => {
    https.get(url, { headers: { 'User-Agent': 'Inputrix-Updater/1.0.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        followAndDownload(res.headers.location)
        return
      }
      if (res.statusCode !== 200) {
        resolve({ ok: false, error: `Erro HTTP ${res.statusCode} ao baixar atualização.` })
        return
      }

      const totalBytes = Number(res.headers['content-length'] || 0)
      let receivedBytes = 0
      const fileStream = fs.createWriteStream(destPath)

      res.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length
        const pct = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 50
        const recMb = (receivedBytes / 1048576).toFixed(1)
        const totMb = totalBytes > 0 ? (totalBytes / 1048576).toFixed(1) : '?'
        onProgress(pct, recMb, totMb)
      })

      res.pipe(fileStream)

      fileStream.on('finish', () => {
        fileStream.close(() => {
          try {
            const child = spawn(destPath, [], { detached: true, stdio: 'ignore' })
            child.unref()
            setTimeout(() => app.quit(), 600)
            resolve({ ok: true })
          } catch (e: any) {
            resolve({ ok: false, error: e?.message || 'Erro ao executar instalador.' })
          }
        })
      })

      fileStream.on('error', (err) => resolve({ ok: false, error: err.message }))
    }).on('error', (err) => resolve({ ok: false, error: err.message }))
  }

  followAndDownload(downloadUrl)
})
