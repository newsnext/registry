import { readdir } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { actionManifestSchema, firstJsonSchemaIssue, insightManifestSchema, pluginManifestSchema } from "@newsnext/sdk/schemas"
import { resolveProvider } from "@newsnext/sdk/source/registry"

const rootDir = dirname(fileURLToPath(import.meta.url))
const check = Bun.argv.includes("--check")
const ID_PATTERN = /^[\w-]+$/
const TEST_FILE_REGEX = /\.(?:test|spec)\.[cm]?js$/
const manifestSchemas = { action: actionManifestSchema, insight: insightManifestSchema, plugin: pluginManifestSchema }

type Kind = keyof typeof manifestSchemas
interface ResourceEntry { path: string, manifest: Record<string, unknown> }
interface Contents {
  sources: Record<string, string>
  actions: Record<string, ResourceEntry>
  insights: Record<string, ResourceEntry>
}
interface PluginEntry extends ResourceEntry, Contents {}
interface Catalog extends Contents { plugins: Record<string, PluginEntry> }

async function writeIfChanged(path: string, content: string): Promise<void> {
  const file = Bun.file(path)
  const currentContent = await file.exists() ? await file.text() : undefined
  if (currentContent !== content) await file.write(content)
}

async function entries(path: string): Promise<import("node:fs").Dirent[]> {
  return (await readdir(join(rootDir, path), { withFileTypes: true }))
    .filter(entry => !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
}

function validateId(id: string): void {
  if (!ID_PATTERN.test(id)) throw new Error(`Invalid registry ID "${id}"`)
}

async function manifest(kind: Kind, path: string): Promise<ResourceEntry> {
  const value: unknown = await Bun.file(join(rootDir, path, `${kind}.json`)).json()
  const issue = firstJsonSchemaIssue(manifestSchemas[kind], value)
  if (issue) throw new Error(`Invalid ${kind} '${path}': ${issue.instancePath} ${issue.message}`)
  return { path, manifest: value as Record<string, unknown> }
}

let sourceCount = 0
async function sources(root: string): Promise<Record<string, string>> {
  const providers = new Map<string, string>()
  for (const entry of await entries(root)) {
    if (TEST_FILE_REGEX.test(entry.name)) continue
    let path = `${root}/${entry.name}`
    let id = entry.name
    if (entry.isDirectory()) {
      const modules: string[] = []
      for (const name of ["index.js", "index.mjs"]) {
        if (await Bun.file(join(rootDir, path, name)).exists()) modules.push(name)
      }
      if (modules.length !== 1) throw new Error(`Expected one Source entry in '${path}'`)
      path += `/${modules[0]}`
    } else {
      if (!entry.isFile() || ![".json", ".js", ".mjs"].includes(extname(path))) continue
      id = basename(path, extname(path))
    }
    validateId(id)
    if (providers.has(id)) throw new Error(`Duplicate provider ID "${id}"`)
    try {
      const module = await import(join(rootDir, path)) as { default: unknown }
      sourceCount += Object.keys(resolveProvider(id, module.default).sources).length
    } catch (error) {
      throw new Error(`Invalid Source provider '${path}'`, { cause: error })
    }
    providers.set(id, path)
  }
  return Object.fromEntries(providers)
}

async function resources(kind: "action" | "insight", root: string): Promise<Record<string, ResourceEntry>> {
  const result = new Map<string, ResourceEntry>()
  for (const entry of await entries(root)) {
    if (!entry.isDirectory()) throw new Error(`Expected a ${kind} directory at '${root}/${entry.name}'`)
    validateId(entry.name)
    const path = `${root}/${entry.name}`
    const resource = await manifest(kind, path)
    if (kind === "action" && !await Bun.file(join(rootDir, path, "index.mjs")).exists()) {
      throw new Error(`Missing Action entry '${path}/index.mjs'`)
    }
    result.set(entry.name, resource)
  }
  return Object.fromEntries(result)
}

async function contents(root: string): Promise<Contents> {
  // Plugins may contain any subset of the three resource kinds.
  const present = new Set((await entries(root)).filter(entry => entry.isDirectory()).map(entry => entry.name))
  const path = (name: string): string => root ? `${root}/${name}` : name
  return {
    sources: present.has("sources") ? await sources(path("sources")) : {},
    actions: present.has("actions") ? await resources("action", path("actions")) : {},
    insights: present.has("insights") ? await resources("insight", path("insights")) : {},
  }
}

async function generate(): Promise<void> {
  const plugins = new Map<string, PluginEntry>()
  const standalone = await contents("")
  for (const entry of await entries("plugins")) {
    if (!entry.isDirectory()) throw new Error(`Expected a plugin directory at 'plugins/${entry.name}'`)
    validateId(entry.name)
    const path = `plugins/${entry.name}`
    plugins.set(entry.name, { ...await manifest("plugin", path), ...await contents(path) })
  }
  const catalog: Catalog = { ...standalone, plugins: Object.fromEntries(plugins) }
  if (!check) {
    const providers = Object.entries(catalog.sources)
    const imports = providers.map(([, file], index) => `import provider_${index} from "./${file}"`)
    const properties = providers.map(([id], index) => `  ${JSON.stringify(id)}: provider_${index},`)
    await writeIfChanged(join(rootDir, "sources.js"), `// Auto-generated by build.ts; do not edit manually.\n${imports.join("\n")}\n\nexport default {\n${properties.join("\n")}\n}\n`)
    await writeIfChanged(join(rootDir, "sources.d.ts"), `// Auto-generated by build.ts; do not edit manually.\nimport type { ProviderConfig } from "@newsnext/sdk/source/registry"\n\ndeclare const providers: Record<string, ProviderConfig>\nexport default providers\n`)
    await writeIfChanged(join(rootDir, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`)
  }
  console.log(`Validated ${Object.keys(catalog.sources).length} bundled Providers, ${sourceCount} total Sources, ${plugins.size} Plugins, ${Object.keys(catalog.actions).length} Actions and ${Object.keys(catalog.insights).length} Insights${check ? "" : "; generated registry indexes"}`)
}

await generate()
