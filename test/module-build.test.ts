/**
 * Runs the real `nuxt-module-build build` and fails on any build warning.
 *
 * The builder exits non-zero on warnings (`failOnWarn`), which covers
 * d.ts-generation problems such as TS2742 ("inferred type cannot be named
 * without a reference to node_modules/…") that only surface at pack time —
 * CI otherwise never executes the module build.
 */
// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, it, expect } from 'vitest'

const execFileAsync = promisify(execFile)
const rootDir = join(fileURLToPath(import.meta.url), '../..')

describe('module build', () => {
  it('builds without warnings or type errors', { timeout: 240_000 }, async () => {
    let stdout: string
    let stderr: string
    let exitCode = 0
    try {
      ({ stdout, stderr } = await execFileAsync(
        join(rootDir, 'node_modules/.bin/nuxt-module-build'),
        ['build'],
        { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 },
      ))
    }
    catch (error) {
      const e = error as { code?: number, stdout?: string, stderr?: string }
      exitCode = e.code ?? 1
      stdout = e.stdout ?? ''
      stderr = e.stderr ?? ''
    }

    const output = `${stdout}\n${stderr}`
    expect(output).not.toMatch(/error TS\d+/)
    expect(output).not.toContain('mkdist build failed')
    expect(exitCode, `nuxt-module-build exited with ${exitCode}:\n${output}`).toBe(0)
  })
})
