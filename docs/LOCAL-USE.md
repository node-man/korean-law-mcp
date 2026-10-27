# Korean Law MCP 로컬 사용 가이드

이 문서는 `local/stdio-hardening` 브랜치의 **`4.15.14-local.1`을 소스에서 빌드하고, 내 컴퓨터의 STDIO MCP 서버로 연결**하는 방법을 설명합니다. 준비된 소스가 사용자의 Windows PC에 설치되었다는 의미는 아닙니다. 아래 경로 `E:/Projects/korean-law-mcp`는 예시이며, 실제로 내려받은 위치로 바꾸세요.

이 버전은 개인 fork의 소스 체크아웃으로 사용합니다. `package.json`의 `private: true`는 실수로 원본 이름의 npm 패키지를 게시하지 않도록 하는 설정이며, GitHub 저장소의 공개·비공개 상태와는 별개입니다.

로컬 서버는 공개 중계 서버를 거치지 않고 법제처에 직접 요청합니다. 법령·판례를 새로 조회할 때는 인터넷 연결과 본인의 법제처 인증키(OC)가 필요합니다. 국세청 본문 조회는 국세법령정보시스템에 연결될 수 있습니다. 로컬 설치가 전체 법률 데이터의 오프라인 보관을 제공하지는 않습니다.

## 1. 소스와 실행 환경 준비

필요한 환경은 Git과 Node.js 20.19 이상입니다. 원본 README는 22.12 이상을 권장합니다. 이 브랜치의 [CI 설정](../.github/workflows/ci.yml)은 20.19.0·22.12.0·24를 대상으로 하며, 이번 작업의 실제 로컬 실행 환경은 **Node.js 24.22.1**입니다. CI에 다른 버전이 선언되어 있다는 사실이 이번 작업에서 해당 버전까지 실행했다는 뜻은 아닙니다. 최소 버전 조건은 [package.json](../package.json)을 참고하세요.

이미 전달받은 작업 폴더가 있으면 그 폴더에서 시작합니다. GitHub fork와 작업 브랜치가 게시된 뒤 새 PC에서 내려받을 때는 다음과 같이 실행합니다.

```powershell
git clone --branch local/stdio-hardening https://github.com/node-man/korean-law-mcp.git E:/Projects/korean-law-mcp
Set-Location E:/Projects/korean-law-mcp
node --version
npm --version
npm ci --ignore-scripts
npm run build
```

`npm ci --ignore-scripts`는 잠금 파일에 따라 의존성을 설치하면서 설치 스크립트를 실행하지 않습니다. 개발·테스트에 필요한 플랫폼별 optional 바이너리는 설치 대상에 남깁니다.

macOS·Linux에서는 원하는 경로에 같은 브랜치를 내려받고, 그 폴더에서 같은 `npm ci --ignore-scripts`와 `npm run build`를 실행하면 됩니다.

## 2. 본인의 OC를 로컬 파일에 저장

[법제처 국가법령정보 공동활용](https://open.law.go.kr/LSO/usrJoin.do)에서 본인 용도의 API 인증키를 준비합니다. 실제 키는 채팅이나 이슈에 붙여넣지 않고 로컬 편집기로 입력하세요.

Windows PowerShell에서 저장소 루트의 파일을 엽니다.

```powershell
notepad .env.local
```

파일에 다음 형식으로 저장하되, 예시 값은 본인의 OC로 교체합니다.

```dotenv
LAW_OC=YOUR_LAW_OC
```

`.env.local`은 [.gitignore](../.gitignore)에 포함됩니다. 키가 비어 있거나 예시 값이면 로컬 실행기는 시작을 거부합니다. 키 내용을 출력하지 않고 제외 여부만 확인하려면 다음 명령을 사용합니다.

```powershell
git check-ignore .env.local
```

### 환경변수 우선순위

- 실행 프로세스가 이미 받은 `LAW_OC`가 `.env.local`보다 우선합니다. 파일을 바꿔도 예전 키가 사용되면, 클라이언트 실행 환경에 남은 `LAW_OC`를 확인하세요.
- 기본 파일은 **저장소 루트의 `.env.local`**입니다. MCP 클라이언트의 작업 폴더가 달라도 이 위치를 사용합니다.
- 별도 파일을 쓰려면 `LAW_ENV_FILE`에 파일의 절대 경로를 지정합니다. 해당 파일에도 `LAW_OC=...` 형식으로 저장합니다. 저장소 밖의 개인 설정 폴더를 사용할 수 있습니다.
- `LAW_OC`가 없으면 기존 호환 변수 `KOREAN_LAW_API_KEY`도 읽습니다. 새 설정에는 `LAW_OC`를 사용하세요. 일반 `.env`만 설정한 경우에는 이 실행기의 키 확인을 통과하지 않으므로 `.env.local` 또는 위 환경변수 방식을 사용합니다.

PowerShell에서 별도 파일을 지정하는 예시는 다음과 같습니다. 이 명령 자체에는 키 값이 없습니다.

```powershell
$env:LAW_ENV_FILE = "E:/PrivateConfig/korean-law.env"
node E:/Projects/korean-law-mcp/scripts/start-local.mjs
```

macOS·Linux에서는 같은 경로 역할을 하는 파일을 준비한 뒤 아래 형식을 사용합니다.

```bash
LAW_ENV_FILE=/absolute/private/path/korean-law.env node /absolute/path/korean-law-mcp/scripts/start-local.mjs
```

환경변수 방식으로 MCP 클라이언트에 전달할 때는 클라이언트가 해당 변수를 자식 프로세스에 전달하도록 설정해야 합니다. 기본 `.env.local` 방식을 쓰면 이 전달 설정이 필요하지 않습니다.

## 3. 먼저 연결 구조를 확인

```powershell
npm run smoke:local
```

이 검사는 실제 법제처 조회 없이 MCP 초기화, 실행 중인 서버와 `package.json`의 버전 일치, 도구 목록 조회, `execute_tool`을 통한 `parse_jo_code` 실행을 확인합니다. 검사 전용 임시 환경 파일을 사용하므로 개인 OC 없이 실행할 수 있으며, 사용자의 `.env.local`을 읽지 않습니다. 통과는 로컬 MCP 통신이 동작한다는 뜻이며, 법제처 인증 성공이나 실제 법령 데이터의 정확성을 검증한 것은 아닙니다.

직접 시작할 때는 다음 명령을 사용합니다.

```powershell
npm run start:local
```

서버는 STDIO 요청을 기다립니다. 웹 페이지나 포트를 열지 않으며, 직접 실행한 터미널에서 종료하려면 `Ctrl+C`를 누릅니다. MCP 클라이언트 연결 시에는 다음 절의 `node .../scripts/start-local.mjs` 실행 명령을 사용하고, 별도 터미널 서버를 미리 켜둘 필요는 없습니다.

## 4. MCP 클라이언트 연결

### 일반 JSON 설정

**사용할 PC의 체크아웃에서** 실행하면 해당 경로에 맞는 JSON을 출력합니다.

```powershell
node scripts/local-config.mjs
```

동일한 npm 명령은 `npm run --silent config:local`입니다. 스크립트는 현재 실행한 Node.js와 로컬 실행기 파일의 **절대 경로**를 출력하며, 키 값을 출력하거나 클라이언트 설정 파일을 자동으로 수정하지 않습니다. 출력된 서버 항목을 사용하는 클라이언트의 MCP 설정에 추가합니다. 기존 MCP 설정이 있으면 해당 항목만 병합하세요.

명령의 핵심은 다음 구조입니다. 실제 생성된 출력을 우선 사용하세요.

```json
{
  "mcpServers": {
    "korean-law-local": {
      "command": "node",
      "args": ["E:/Projects/korean-law-mcp/scripts/start-local.mjs"]
    }
  }
}
```

GUI 앱에서 `node`를 찾지 못한다면 PowerShell의 `(Get-Command node).Source`로 확인한 실행 파일의 절대 경로를 `command`에 넣습니다. 다른 OS나 WSL에서 생성한 경로를 Windows 앱에 그대로 넣지 말고, **MCP 프로세스를 실제 실행할 환경에서** 설정을 생성하세요.

### Codex TOML 설정

```powershell
node scripts/local-config.mjs --format codex
```

동일한 npm 명령은 `npm run --silent config:local -- --format codex`입니다. 출력된 `[mcp_servers.korean-law-local]` 항목을 사용하는 Codex의 `config.toml`에 추가합니다. 출력에는 `LAW_OC`, `LAW_ENV_FILE`, `KOREAN_LAW_API_KEY`를 전달하는 `env_vars` 이름 목록이 포함되며 키 값은 포함되지 않습니다. 공식 문서의 기본 사용자 설정 경로는 `~/.codex/config.toml`이며, 신뢰된 프로젝트에는 `.codex/config.toml`을 사용할 수도 있습니다. 설정 파일의 기존 내용을 덮어쓰지 말고 해당 서버 항목을 병합하세요.

`command`, `args`, `cwd`, 환경변수 전달을 위한 `env_vars`는 공식 STDIO MCP 설정 항목입니다. 이 안내는 [OpenAI의 MCP 설정 문서](https://developers.openai.com/codex/mcp)를 2026-10-27에 확인했습니다. 이 로컬 설정이 ChatGPT 웹의 플러그인을 자동으로 추가하지는 않습니다.

클라이언트를 다시 시작한 뒤 `korean-law-local` 서버가 연결되는지 확인합니다. Codex CLI에서는 `codex mcp list`로 등록 목록을 확인하고, 세션의 `/mcp`에서 활성 서버를 확인할 수 있습니다.

### 이번 로컬 버전의 실행 경로

이 브랜치에서 사용할 명령은 **체크아웃의 `scripts/start-local.mjs`**입니다. 원본 README의 `npx korean-law-mcp setup`은 npm 배포판을 설치·설정하고, Claude 플러그인은 제작자의 공개 서버를 연결하므로 이 작업 브랜치의 수정 사항을 실행하지 않습니다.

## 5. 실제 조회 확인

본인 OC와 인터넷 연결이 준비되면, 연결한 클라이언트에서 다음과 같이 요청해 봅니다.

> `korean-law-local`의 `search_law`로 민법을 검색하고, 반환된 법령 ID·버전 정보를 사용해 제1조를 조회해줘. 적용된 시행일과 출처 링크도 표시해줘.

이때 확인할 것은 도구 호출 성공, 검색한 법령명과 조회 결과의 일치, 시행일·출처 표시입니다. 오류·부분 결과·미검증 표시가 나오면 그대로 유지하고 완전한 검증 결과로 바꾸지 않습니다.

법제처 이용 안내는 과도한 단시간 호출에 제한이 있을 수 있다고 밝힙니다. 실제 조회 검증은 필요한 소수 사례로 시작하고, 자체 서비스의 대량 호출은 해당 이용 조건에 맞춰 조정하세요. 출처: [법제처 신청 및 이용 안내](https://open.law.go.kr/LSO/usrJoin.do).

## 6. 이번 수정 범위와 남은 한계

로컬 실행기와 설정 출력·오프라인 연결 검사를 추가하고, 리뷰에서 확인한 다음 네 종류의 결과 오류를 보완합니다.

| 대상 | 보완한 동작 |
| --- | --- |
| 인용의 호·목 범위 | 해당 항의 호를 확인하고, 지원하지 않거나 판정할 수 없는 목·범위는 미검증으로 표시 |
| 같은 조문의 서로 다른 인용 | 동일 조문 뒤에 다른 제목 주장이 나와도 검증에서 사라지지 않도록 처리 |
| 법령 이름 동일성 | 시행령·시행규칙을 찾다가 모법으로 검색이 완화되어도 원래 인용이 검증된 것으로 처리하지 않음 |
| 폐지 후 시점 비교 | 폐지 상태를 두 날짜에 시행 중인 동일 법령 버전으로 표시하지 않음 |

관련 회귀 사례는 [인용 검증 테스트](../src/tools/verify-citations.local.test.ts)와 [시점 비교 테스트](../src/tools/scenarios/time-travel.local.test.ts)에 있습니다. 네 항목의 보완과 연결 검사 통과가 모든 법령·판례·법률적 해석의 정확성을 보장하지는 않습니다. 공식 데이터의 누락, 검색 범위, 본문 축약, 규칙 기반 분석의 한계는 별도로 고려해야 합니다.

이 소프트웨어는 [MIT 라이선스](../LICENSE)로 제공되지만, [NOTICE](../NOTICE)에 제3자 구현을 참조한 모듈의 재배포 권리 불확실성이 남아 있습니다. 이번 로컬 실행·검증 보완은 그 권리 문제를 해결하지 않습니다. 제품에 포함하거나 재배포하기 전에는 해당 고지의 허락 확인 또는 독립 구현 교체를 완료해야 합니다.

## 7. fork 유지보수

다음 역할로 저장소를 관리합니다.

| 항목 | 역할 |
| --- | --- |
| `origin` | 개인 fork `node-man/korean-law-mcp` |
| `upstream` | 원본 `chrisryugj/korean-law-mcp` |
| `main` | 원본 변경을 따라가는 기준 브랜치 |
| `local/stdio-hardening` | 로컬 실행 및 검증 보완 브랜치 |

fork를 새로 clone한 환경에서 `upstream`이 없으면 추가합니다.

```powershell
git remote add upstream https://github.com/chrisryugj/korean-law-mcp.git
git fetch upstream
```

원본 업데이트를 적용할 때는 변경 내용을 확인해 `main`에 반영한 후 작업 브랜치와 병합합니다. 의존성이 달라졌으면 `npm ci --ignore-scripts`를 다시 실행하고, `npm run build`, `npm test`, `npm run smoke:local`로 검증합니다. MCP 클라이언트를 다시 시작해야 새 빌드를 사용합니다.

## 문제 해결

| 증상 | 확인할 항목 |
| --- | --- |
| `LAW_OC` 누락·예시 값 오류 | 저장소 루트 `.env.local` 또는 `LAW_ENV_FILE`의 경로, 실제 발급된 값, 기존 프로세스의 `LAW_OC` 우선 적용 여부 |
| `build` 파일을 찾지 못함 | 해당 체크아웃에서 `npm ci --ignore-scripts` 후 `npm run build` 실행 여부 |
| MCP 클라이언트가 실행 파일을 찾지 못함 | `command`의 Node.js 경로, `args`의 절대 경로, Windows/WSL 등 실행 환경 일치 여부 |
| 수동 실행 후 응답이 없어 보임 | STDIO 서버가 요청을 기다리는 상태인지 확인하고 클라이언트에서 연결 |
| 오프라인 검사 성공 후 실제 조회 실패 | 개인 OC의 사용 신청, 네트워크·프록시, 법제처/국세청 응답 상태 확인 |
| 수정 사항이 보이지 않음 | 작업 브랜치의 소스를 다시 빌드했는지, npm 배포판/공개 서버가 아닌 로컬 스크립트를 연결했는지 확인 |
