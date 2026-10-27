import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LawApiClient } from "../lib/api-client.js"
import { lawCache } from "../lib/cache.js"
import { parseCitations, verifyCitations } from "./verify-citations.js"

const lawRow = (name: string) => `<LawSearch><totalCnt>1</totalCnt><law>` +
  `<법령일련번호>100</법령일련번호><법령ID>000001</법령ID><법령명한글>${name}</법령명한글>` +
  `</law></LawSearch>`
const empty = "<LawSearch><totalCnt>0</totalCnt></LawSearch>"
const ho = (number: string) => ({ 호번호: number, 호내용: `${number} 검토 항목` })

function client(parts: Record<string, unknown> = {}, name = "검토법") {
  return {
    searchLaw: vi.fn(async (_query: string, _key?: string, _display?: number, target?: string) =>
      target === "eflaw" ? empty : lawRow(name)),
    getLawText: vi.fn(async () => JSON.stringify({ 법령: { 조문: { 조문단위: {
      조문여부: "조문", 조문번호: "1", 조문제목: "목적", 조문내용: "제1조(목적) 검토 규정", ...parts,
    } } } })),
    fetchApi: vi.fn(async () => empty),
  }
}

const verify = (api: ReturnType<typeof client>, text: string) =>
  verifyCitations(api as unknown as LawApiClient, { text, maxCitations: 15 })

beforeEach(() => lawCache.clear())

describe("local citation verification — 호 scope and unsupported 목", () => {
  it("rejects a nonexistent 호 inside an existing 항", async () => {
    const result = await verify(client({ 항: { 항번호: "①", 호: ho("1.") } }), "검토법 제1조 제1항 제999호")
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("제999호")
    expect(result.content[0].text).toContain("[NOT_FOUND]")
  })

  it("accepts a single-object 호 in the requested single-object 항", async () => {
    const result = await verify(client({ 항: { 항번호: "①", 호: ho("1.") } }), "검토법 제1조 제1항 제1호")
    expect(result.content[0].text).toContain("[VERIFIED]")
    expect(result.content[0].text).toContain("제1항 제1호 실존")
  })

  it("does not borrow a 호 from another 항", async () => {
    const api = client({ 항: [{ 항번호: "①", 호: ho("1.") }, { 항번호: "②", 호: ho("2.") }] })
    const result = await verify(api, "검토법 제1조 제1항 제2호")
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("제2호 없음")
  })

  it.each(["1.", "제1호"])("checks top-level 호 (%s)", async number => {
    const api = client({ 호: ho(number) })
    expect((await verify(api, "검토법 제1조 제1호")).content[0].text).toContain("제1호 실존")
    expect((await verify(api, "검토법 제1조 제2호")).isError).toBe(true)
  })

  it("accepts 호 nested in the API's sole unnumbered 항 container", async () => {
    const result = await verify(client({ 항: { 항내용: "다음 각 호", 호: ho("1.") } }), "검토법 제1조 제1호")
    expect(result.content[0].text).toContain("[VERIFIED]")
    expect(result.content[0].text).toContain("제1호 실존")
  })

  it("marks a 호 without its numbered 항 as partial", async () => {
    const result = await verify(client({ 항: [{ 항번호: "①", 호: ho("1.") }, { 항번호: "②", 호: ho("1.") }] }), "검토법 제1조 제1호")
    expect(result.content[0].text).toContain("[PARTIAL_VERIFIED]")
    expect(result.content[0].text).toContain("항번호")
  })

  it("marks unparseable 호 numbering as partial instead of proving absence", async () => {
    const result = await verify(client({ 호: [{ 호번호: "알 수 없음", 호내용: "원문 항목" }] }), "검토법 제1조 제1호")
    expect(result.content[0].text).toContain("[PARTIAL_VERIFIED]")
    expect(result.isError).not.toBe(true)
  })

  it("does not mistake 호의2 for the base 호", async () => {
    const api = client({ 호: ho("1의2.") })
    expect((await verify(api, "검토법 제1조 제1호")).isError).toBe(true)
    expect((await verify(api, "검토법 제1조 제1호의2")).content[0].text).toContain("제1호의2 실존")
  })

  it("does not certify a 목 that was not checked", async () => {
    const result = await verify(client({ 호: ho("1.") }), "검토법 제1조 제1호 가목")
    expect(result.content[0].text).toContain("[PARTIAL_VERIFIED]")
    expect(result.content[0].text).toContain("가목 미검증")
  })

  it("distinguishes a 목 citation with a particle from ordinary prose", () => {
    expect(parseCitations("검토법 제1조 제1호 가목에 따른다", 15)[0].mok).toBe("가")
    expect(parseCitations("검토법 제1조가 목표이다", 15)[0].mok).toBeUndefined()
  })
})

describe("local citation verification — conflicting repeated claims", () => {
  it.each(["검토법 제1조(목적).", "검토법 제1조."])("checks a later wrong title after %s", async first => {
    const api = client()
    const result = await verify(api, `${first} 검토법 제1조(과태료).`)
    expect(result.content[0].text).toContain("[HALLUCINATION_DETECTED]")
    expect(result.content[0].text).toContain("법령 인용 2건")
    expect(result.content[0].text).toContain("[CONTENT_MISMATCH]")
    expect(api.getLawText).toHaveBeenCalledTimes(1)
  })

  it("still deduplicates identical citations", () => {
    expect(parseCitations("검토법 제1조(목적). 검토법 제1조(목적).", 15)).toHaveLength(1)
  })
})

describe("local citation verification — strict statute identity", () => {
  it.each(["계엄법", "계엄법 시행령"])("preserves exact official names before typo normalization: %s", async name => {
    const result = await verify(client({}, name), `${name} 제1조`)
    expect(result.content[0].text).toContain("[VERIFIED]")
    expect(result.content[0].text).toContain(`${name} 제1조`)
  })

  it("does not verify the parent law when a decree search falls back", async () => {
    const api = client()
    api.searchLaw.mockImplementation(async (query, _key, _display, target) =>
      target === "eflaw" || query === "검토법 시행령" ? empty : lawRow("검토법"))
    const result = await verify(api, "검토법 시행령 제1조")
    expect(result.content[0].text).toContain("[PARTIAL_VERIFIED]")
    expect(api.getLawText).not.toHaveBeenCalled()
  })

  it.each([
    ["검토법", "검토법 시행령"],
    ["검토법 시행령", "검토법 시행규칙"],
    ["검토법 시행규칙", "검토법"],
    ["검토법", "검토법 시행에 관한 법률"],
  ])("does not identify %s as %s", async (requested, actual) => {
    const api = client({}, actual)
    const result = await verify(api, `${requested} 제1조`)
    expect(result.content[0].text).toContain("[PARTIAL_VERIFIED]")
    expect(api.getLawText).not.toHaveBeenCalled()
  })

  it.each([
    ["화관법", "화학물질관리법"],
    ["화관법 시행령", "화학물질관리법 시행령"],
    ["화관법 시행규칙", "화학물질관리법 시행규칙"],
    ["식품 등의 표시·광고에 관한 법률", "식품 등의 표시ㆍ광고에 관한 법률"],
  ])("preserves explicit aliases and typography: %s", async (requested, actual) => {
    const result = await verify(client({}, actual), `${requested} 제1조`)
    expect(result.content[0].text).toContain("[VERIFIED]")
    expect(result.content[0].text).toContain(`${actual} 제1조`)
  })
})
