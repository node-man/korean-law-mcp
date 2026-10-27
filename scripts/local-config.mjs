#!/usr/bin/env node
// Generate on the computer that will run the MCP process. No config is overwritten.
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const format = args.length === 0 ? "json" : args.length === 2 && args[0] === "--format" ? args[1] : ""
if (!["json", "codex"].includes(format)) {
  process.stderr.write("사용법: node scripts/local-config.mjs [--format json|codex]\n")
  process.exit(1)
}

const command = process.execPath
const serverArgs = [resolve(root, "scripts/start-local.mjs")]
if (format === "codex") {
  process.stdout.write([
    "[mcp_servers.korean-law-local]",
    `command = ${JSON.stringify(command)}`,
    `args = ${JSON.stringify(serverArgs)}`,
    'env_vars = ["LAW_OC", "LAW_ENV_FILE", "KOREAN_LAW_API_KEY"]',
    "",
  ].join("\n"))
} else {
  process.stdout.write(JSON.stringify({ mcpServers: { "korean-law-local": { command, args: serverArgs } } }, null, 2) + "\n")
}
