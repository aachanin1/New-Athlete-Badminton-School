import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve as resolveAlias } from '../../scripts/ts-alias-loader.mjs'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const candidate = new URL(specifier + '.ts', context.parentURL)
    if (fs.existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true }
  }
  return resolveAlias(specifier, context, nextResolve)
}
