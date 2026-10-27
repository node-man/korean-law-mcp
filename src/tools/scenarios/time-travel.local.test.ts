import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchLawVersions } from "../../lib/law-lineage.js"
import type { HistoricalVersion } from "../../lib/historical-utils.js"
import type { ScenarioContext } from "./types.js"
import { runTimeTravelScenario } from "./time-travel.js"

vi.mock("../../lib/law-lineage.js", async original => ({
  ...await original<typeof import("../../lib/law-lineage.js")>(), fetchLawVersions: vi.fn(),
}))

const row = (mst: string, efYd: string, rrCls: string): HistoricalVersion => ({
  mst, efYd, rrCls, lawNm: "테스트법", ancNo: mst, ancYd: efYd,
})
const active = row("100", "20030101", "일부개정")
const repealed = row("200", "20040530", "타법폐지")

function setVersions(versions: HistoricalVersion[]) {
  vi.mocked(fetchLawVersions).mockResolvedValue({
    versions, totalCount: versions.length, fetchedPages: 1, source: "lineage",
  })
}

function context(fromDate: string, toDate: string) {
  const fetchApi = vi.fn(async (p: { extraParams: { MST: string } }) => JSON.stringify({
    법령: { 조문: { 조문단위: [{
      조문여부: "조문", 조문번호: "1", 조문내용: `제1조 판본 ${p.extraParams.MST}`,
    }] } },
  }))
  const ctx = { query: "테스트법", extras: { fromDate, toDate }, apiClient: { fetchApi } } as unknown as ScenarioContext
  return { ctx, fetchApi }
}

beforeEach(() => {
  vi.mocked(fetchLawVersions).mockReset()
  setVersions([repealed, active])
})

describe("time_travel — 폐지 상태를 시행 판본으로 비교하지 않는다", () => {
  it.each(["폐지", "타법폐지", "일괄폐지"])("두 폐지 후 시점: %s 행은 '동일 시행 버전'이 아니다", async rrCls => {
    setVersions([{ ...repealed, rrCls }, active])
    const { ctx, fetchApi } = context("20050101", "20260101")
    const result = await runTimeTravelScenario(ctx)
    const text = result.sections.map(s => s.content).join("\n")

    expect(text).toContain("시점 A: 2005.01.01 기준 | 폐지 상태")
    expect(text).toContain("시점 B: 2026.01.01 기준 | 폐지 상태")
    expect(text).toContain(`2004.05.30 ${rrCls}`)
    expect(text).toContain("두 시점 모두 연혁상 폐지 상태")
    expect(text).not.toContain("동일 버전")
    expect(text).not.toContain("변경 없음")
    expect(fetchApi).not.toHaveBeenCalled()
    expect(result.suggestedActions.join("\n")).not.toContain("시행 20040530 본문")
  })

  it.each([
    ["20040529", "20040530", "시점 A: 2004.05.29 기준 | 시행 중", "시점 B: 2004.05.30 기준 | 폐지 상태"],
    ["20040530", "20040529", "시점 A: 2004.05.30 기준 | 폐지 상태", "시점 B: 2004.05.29 기준 | 시행 중"],
  ])("폐지 당일 경계와 역방향 비교: %s → %s", async (fromDate, toDate, a, b) => {
    const { ctx, fetchApi } = context(fromDate, toDate)
    const result = await runTimeTravelScenario(ctx)
    const text = result.sections.map(s => s.content).join("\n")

    expect(text).toContain(a)
    expect(text).toContain(b)
    expect(text).toContain("MST 100")
    expect(text).toContain("MST 200")
    expect(text).toContain("부칙·경과조치")
    expect(text).not.toContain("신설 조문")
    expect(text).not.toContain("삭제 조문")
    expect(text).not.toContain("본문 동일")
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it("폐지일 전 두 시점은 기존의 동일 시행 판본으로 유지한다", async () => {
    const { ctx, fetchApi } = context("20040101", "20040529")
    const result = await runTimeTravelScenario(ctx)
    const text = result.sections.map(s => s.content).join("\n")

    expect(text).toContain("동일 버전 (시행 20030101, MST 100)")
    expect(text).not.toContain("폐지 상태")
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it("같은 날 구법 폐지와 신법 제정이 있으면 신법 시행 판본의 diff를 유지한다", async () => {
    const replacement = row("300", "20040530", "제정")
    setVersions([replacement, { ...repealed, priorLaw: true }, { ...active, priorLaw: true }])
    const { ctx, fetchApi } = context("20040529", "20040530")
    const result = await runTimeTravelScenario(ctx)
    const text = result.sections.map(s => s.content).join("\n")

    expect(text).toContain("시점 B: 2004.05.30 시행 | MST 300")
    expect(text).toContain("폐지 후 재제정")
    expect(text).not.toContain("폐지 상태")
    expect(fetchApi).toHaveBeenCalledTimes(2)
    expect(fetchApi.mock.calls.map(([p]) => p.extraParams.MST).sort()).toEqual(["100", "300"])
  })
})
