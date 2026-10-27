#!/usr/bin/env node
// Exercise the real launcher + MCP transport without calling a law API.
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))
const temporary = mkdtempSync(resolve(tmpdir(), "korean-law-smoke-"))
const envFile = resolve(temporary, "smoke.env")
// Do not load the user's .env.local or use their OC during this offline check.
writeFileSync(envFile, "LAW_OC=korean-law-offline-smoke\n", { mode: 0o600 })
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(root, "scripts/start-local.mjs")],
  cwd: temporary, // Deliberately different from the checkout, as in GUI clients.
  env: { LAW_ENV_FILE: envFile, LAW_OC: "korean-law-offline-smoke" },
  stderr: "pipe",
})
let stderr = ""
transport.stderr?.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-4000) })
const client = new Client({ name: "korean-law-local-smoke", version: "1.0.0" })
const timeout = setTimeout(() => {
  process.stderr.write("로컬 MCP 검사 시간 초과. 서버 빌드와 의존성을 확인하세요.\n")
  void client.close().finally(() => process.exit(1))
}, 20_000)
try {
  await client.connect(transport)
  assert.equal(client.getServerVersion()?.version, version, "현재 체크아웃 버전이 실행되어야 합니다")
  const { tools } = await client.listTools()
  assert(tools.some(tool => tool.name === "execute_tool"), "execute_tool이 등록되어야 합니다")
  assert(tools.some(tool => tool.name === "get_law_text"), "get_law_text가 등록되어야 합니다")
  const result = await client.callTool({
    name: "execute_tool",
    arguments: { tool_name: "parse_jo_code", params: { joText: "제38조", direction: "to_code" } },
  })
  assert(!result.isError, "parse_jo_code 호출이 성공해야 합니다")
  const parsed = result.content.filter(item => item.type === "text").map(item => item.text).join("\n")
  assert.equal(JSON.parse(parsed).output, "003800")
  process.stdout.write(`PASS: ${version} · MCP 초기화 · ${tools.length}개 도구 · 제38조 → 003800\n`)
  process.stdout.write("법제처 API 호출 없이 로컬 STDIO 연결을 확인했습니다. 실제 OC 인증은 별도로 확인하세요.\n")
} catch (error) {
  process.stderr.write(`FAIL: ${error.message}\n${stderr}`)
  process.exitCode = 1
} finally {
  clearTimeout(timeout)
  await client.close()
  await transport.close()
  rmSync(temporary, { recursive: true, force: true })
}
