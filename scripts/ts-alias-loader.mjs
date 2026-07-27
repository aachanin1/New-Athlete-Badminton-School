import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) return nextResolve(specifier, context)

  const sourcePath = path.join(root, 'src', specifier.slice(2))
  const resolvedPath = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`]
    .find((candidate) => fs.existsSync(candidate))

  if (!resolvedPath) return nextResolve(specifier, context)
  return { url: pathToFileURL(resolvedPath).href, shortCircuit: true }
}
