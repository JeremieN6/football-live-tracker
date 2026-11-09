import test from "node:test"
import assert from "node:assert/strict"
import { anthropicCostEvent, trackAnthropicUsage } from "./ops-cost.ts"

test("builds a cost event from an Anthropic response", () => {
  const event = anthropicCostEvent("nrv", { model: "claude-haiku-4-5-20251001", usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 } }, { feature: "match-report" })
  assert.deepEqual(event, {
    project: "nrv",
    provider: "anthropic",
    llm: { model: "claude-haiku-4-5-20251001", inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: undefined },
    meta: { feature: "match-report" },
  })
})

test("ignores errors, empty bodies and non-objects", () => {
  assert.equal(anthropicCostEvent("nrv", null), null)
  assert.equal(anthropicCostEvent("nrv", "texte"), null)
  assert.equal(anthropicCostEvent("nrv", { type: "error", error: { type: "overloaded_error" } }), null)
})

test("does nothing without OPS settings, never throws, and posts to /api/ingest/cost otherwise", async () => {
  const calls: { url: string; key: string }[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, key: init.headers["x-ops-key"] })
    return { ok: true }
  }) as unknown as typeof fetch
  try {
    await trackAnthropicUsage({}, "nrv", { model: "m", usage: { input_tokens: 1 } })
    await trackAnthropicUsage({ url: "https://ops.example/", key: null }, "nrv", { model: "m", usage: { input_tokens: 1 } })
    assert.equal(calls.length, 0)
    await trackAnthropicUsage({ url: "https://ops.example/", key: "k" }, "nrv", { model: "m", usage: { input_tokens: 1 } })
    assert.deepEqual(calls, [{ url: "https://ops.example/api/ingest/cost", key: "k" }])
    globalThis.fetch = (async () => { throw new Error("reseau") }) as unknown as typeof fetch
    await trackAnthropicUsage({ url: "https://ops.example", key: "k" }, "nrv", { model: "m", usage: { input_tokens: 1 } })
  } finally {
    globalThis.fetch = realFetch
  }
})
