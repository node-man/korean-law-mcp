#!/usr/bin/env node
// Run this checkout over STDIO; never resolve a package from npm or start HTTP.
import { existsSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { config as loadEnv } from "dotenv"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const entry = resolve(root, "build/index.js")

function fail(message) {
  process.stderr.write(`[korean-law-local] ${message}\n`)
  process.exit(1)
}

if (process.argv.length > 2) {
  fail("이 실행기는 인자 없이 STDIO로 실행합니다. node scripts/start-local.mjs")
}
if (!existsSync(entry)) {
  fail("빌드가 없습니다. 저장소 폴더에서 npm ci --ignore-scripts 후 npm run build를 실행하세요.")
}

const explicitEnvFile = process.env.LAW_ENV_FILE
if (explicitEnvFile && !isAbsolute(explicitEnvFile)) {
  fail("LAW_ENV_FILE에는 개인 환경 파일의 절대 경로를 지정하세요.")
}
// The server also loads .env. Anchor it to this checkout, not the client's CWD.
process.chdir(root)
const loaded = loadEnv({ path: explicitEnvFile || resolve(root, ".env.local"), quiet: true, override: false })
if (loaded.error && (explicitEnvFile || loaded.error.code !== "ENOENT")) {
  fail("환경 파일을 읽지 못했습니다. LAW_ENV_FILE 또는 .env.local의 위치와 읽기 권한을 확인하세요.")
}

const oc = (process.env.LAW_OC || process.env.KOREAN_LAW_API_KEY || "").trim()
const placeholder = /^(?:YOUR_(?:LAW_)?OC|YOUR_API_KEY|YOUR_EMAIL_ID|REPLACE_ME|CHANGEME|EXAMPLE|TEST|본인키|본인_OC)$/i
if (!oc || placeholder.test(oc)) {
  fail("본인의 LAW_OC가 필요합니다. 저장소의 .env.local 또는 실행 환경에 설정하세요. 키 값을 로그나 채팅에 붙여넣지 마세요.")
}
process.env.LAW_OC = oc

// Guard the protocol before importing server modules as well as during runtime.
const diagnostic = (...values) => process.stderr.write(values.map(String).join(" ") + "\n")
console.log = console.info = console.warn = console.debug = diagnostic
process.argv = [process.execPath, entry]
try {
  await import(pathToFileURL(entry).href)
} catch (error) {
  fail(`서버 시작 실패 (${error?.code || error?.name || "Error"}). 의존성 설치와 빌드를 확인하세요.`)
}
