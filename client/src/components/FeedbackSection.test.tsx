import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Router } from "wouter"

import FeedbackSection from "./FeedbackSection"
import { UI_LABELS } from "../constants/labels"

function renderWithRouter(node: React.ReactElement) {
  return renderToStaticMarkup(<Router ssrPath="/report-new">{node}</Router>)
}

describe("FeedbackSection", () => {
  it("uses the reward copy while the reward is unclaimed", () => {
    const markup = renderWithRouter(
      <FeedbackSection analysisId="analysis-1" rewardAvailable />
    )

    expect(markup).toContain(UI_LABELS.FEEDBACK_TEASER_DESC_REWARD)
    expect(markup).toContain(UI_LABELS.FEEDBACK_TEASER_CTA_REWARD)
  })

  it("falls back to the plain copy once the reward is claimed", () => {
    const markup = renderWithRouter(
      <FeedbackSection analysisId="analysis-1" rewardAvailable={false} />
    )

    expect(markup).toContain(UI_LABELS.FEEDBACK_TEASER_DESC_PLAIN)
    expect(markup).toContain(UI_LABELS.FEEDBACK_TEASER_CTA_PLAIN)
  })

  it("renders nothing without an analysis id", () => {
    const markup = renderWithRouter(
      <FeedbackSection analysisId={null} rewardAvailable={false} />
    )

    expect(markup).toBe("")
  })
})
