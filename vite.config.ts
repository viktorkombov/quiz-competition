import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// The app is deployed to GitHub Pages under https://<user>.github.io/<repo>/.
// The base path must therefore match the repository name. It can be supplied
// through an environment variable so the same code works locally (base "/")
// and on GitHub Pages (base "/<repo>/").
//
// Priority:
//   1. VITE_BASE_PATH   — explicit override, e.g. "/quiz/"
//   2. GITHUB_REPOSITORY — provided automatically by GitHub Actions as
//                          "<owner>/<repo>"; we derive "/<repo>/" from it.
//   3. "/"              — default for local development.
function resolveBasePath(env: Record<string, string>): string {
  const explicit = env.VITE_BASE_PATH
  if (explicit && explicit.trim().length > 0) {
    return normalizeBase(explicit)
  }
  const repository = env.GITHUB_REPOSITORY
  if (repository && repository.includes('/')) {
    const repo = repository.split('/')[1]
    if (repo) return normalizeBase(repo)
  }
  return '/'
}

function normalizeBase(value: string): string {
  let base = value.trim()
  if (!base.startsWith('/')) base = `/${base}`
  if (!base.endsWith('/')) base = `${base}/`
  return base
}

export default defineConfig(({ mode }) => {
  // Load env from .env files as well as the actual process env (CI).
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') } as Record<string, string>

  return {
    base: resolveBasePath(env),
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
