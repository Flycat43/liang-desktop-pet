import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginRoot = path.join(repoRoot, 'plugins', 'liang-harness-plugin')
const releaseDir = path.resolve(process.argv[2] || path.join(repoRoot, 'release'))

const packageJson = JSON.parse(
  await readFile(path.join(pluginRoot, 'package.json'), 'utf8'),
)
const packageStem = packageJson.name.replace(/^@/, '').replaceAll('/', '-')
const versionedName = `${packageStem}-${packageJson.version}.tgz`
const stableName = 'liang-harness-plugin.tgz'
const manualName = 'Liang-Harness-Plugin-Manual.zh-CN.md'
const checksumName = 'SHA256SUMS-plugin.txt'

await mkdir(releaseDir, { recursive: true })

const versionedPath = path.join(releaseDir, versionedName)
const archive = await readFile(versionedPath).catch(() => null)
if (!archive?.length) {
  throw new Error(`Missing packed plugin archive: ${versionedPath}`)
}

await copyFile(versionedPath, path.join(releaseDir, stableName))
await copyFile(path.join(pluginRoot, 'MANUAL.zh-CN.md'), path.join(releaseDir, manualName))

const artifactNames = [versionedName, stableName, manualName]
const checksumLines = []

for (const artifactName of artifactNames) {
  const bytes = await readFile(path.join(releaseDir, artifactName))
  const checksum = createHash('sha256').update(bytes).digest('hex')
  checksumLines.push(`${checksum}  ${artifactName}`)
}

await writeFile(
  path.join(releaseDir, checksumName),
  `${checksumLines.join('\n')}\n`,
  'utf8',
)

console.log(
  `Prepared ${packageJson.name}@${packageJson.version}: ${artifactNames.join(', ')}, ${checksumName}`,
)
