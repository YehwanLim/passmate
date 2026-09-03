import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Router } from "wouter"

import FeedbackRewardBanner from "./FeedbackRewardBanner"
import { UI_LABELS } from "../constants/labels"

function renderWithRouter(node: React.ReactElement) {
  return renderToStaticMarkup(<Router ssrPath="/report-new">{node}</Router>)
}

describe("FeedbackRewardBanner", () => {
  it("shows the reward notice with a survey link while the reward is unclaimed", () => {
    const markup = renderWithRouter(
      <FeedbackRewardBanner analysisId="analysis-1" rewardAvailable />
    )

    expect(markup).toContain(UI_LABELS.FEEDBACK_BANNER_TEXT)
    expect(markup).toContain(UI_LABELS.FEEDBACK_BANNER_CTA)
    expect(markup).toContain("/feedback?analysisId=analysis-1")
  })

  it("renders nothing once the reward is claimed", () => {
    const markup = renderWithRouter(
      <FeedbackRewardBanner analysisId="analysis-1" rewardAvailable={false} />
    )

    expect(markup).toBe("")
  })
})
