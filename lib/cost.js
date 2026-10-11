// Real cost-comparison helpers for OpenClaw Office
//
// Goal: compare what you actually pay to run your agents (local Ollama =
// free, OpenRouter free-tier models = free) against what the same token
// volume would cost on a mainstream paid commercial API. This replaces the
// old "10x human time" fiction with a number grounded in real token counts
// and real published API pricing.

// Reference commercial pricing used as the "what if you paid for a
// mainstream hosted model instead" baseline. Anthropic Claude Sonnet
// pricing, per 1M tokens, as a reasonably representative mid-tier paid
// model — not the agent's actual model.
const COMMERCIAL_REFERENCE = { input: 3, output: 15 } // Claude Sonnet, per 1M tokens

// Known pricing for models actually in use, per 1M tokens. Local/free-tier
// models cost $0 to run. Add entries here if a paid model is ever assigned
// to an agent.
const MODEL_PRICING = [
  { match: /^ollama\//, input: 0, output: 0, label: 'local (Ollama) — free' },
  { match: /:free$/, input: 0, output: 0, label: 'OpenRouter free tier' },
  { match: /openrouter\//, input: 0, output: 0, label: 'OpenRouter (assumed free tier)' },
]

function pricingForModel(model) {
  if (!model) return { input: 0, output: 0, label: 'unknown — assumed free' }
  const found = MODEL_PRICING.find((p) => p.match.test(model))
  return found || { input: 0, output: 0, label: 'unknown — assumed free' }
}

function cost(tokensIn, tokensOut, pricing) {
  return (tokensIn / 1000000) * pricing.input + (tokensOut / 1000000) * pricing.output
}

/**
 * Given a list of { model, inputTokens, outputTokens } per agent, compute
 * real actual cost vs. commercial-equivalent cost and the gap between them.
 */
export function computeCostComparison(agentUsage) {
  let actualCostUsd = 0
  let equivalentCostUsd = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  const perAgent = agentUsage.map(({ id, model, inputTokens = 0, outputTokens = 0 }) => {
    const pricing = pricingForModel(model)
    const actual = cost(inputTokens, outputTokens, pricing)
    const equivalent = cost(inputTokens, outputTokens, COMMERCIAL_REFERENCE)
    actualCostUsd += actual
    equivalentCostUsd += equivalent
    totalInputTokens += inputTokens
    totalOutputTokens += outputTokens
    return {
      id,
      model,
      modelLabel: pricing.label,
      inputTokens,
      outputTokens,
      actualCostUsd: Math.round(actual * 10000) / 10000,
      equivalentCostUsd: Math.round(equivalent * 10000) / 10000,
      savingsUsd: Math.round((equivalent - actual) * 10000) / 10000,
    }
  })

  return {
    perAgent,
    totals: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      actualCostUsd: Math.round(actualCostUsd * 100) / 100,
      equivalentCostUsd: Math.round(equivalentCostUsd * 100) / 100,
      savingsUsd: Math.round((equivalentCostUsd - actualCostUsd) * 100) / 100,
    },
    referenceModel: 'Claude Sonnet ($3/$15 per 1M input/output tokens)',
  }
}
