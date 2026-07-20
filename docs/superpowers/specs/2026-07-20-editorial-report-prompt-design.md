# Editorial Report Prompt Design

## Goal

Keep the existing `MASTER_SYSTEM_PROMPT` JSON contract intact while changing the report from a checklist-style evaluation into an editorial interpretation of the applicant's experiences.

## Single Source

`shared/prompts/reportPrompt.js` remains the only prompt body. The local development route consumes it through the existing TypeScript compatibility export, and the serverless route imports it directly.

## Core Writing Model

1. Find one recurring pattern across the applicant's experiences before drafting sections.
2. Explain that pattern through concrete behaviors, decisions, evidence, and transitions between experiences.
3. Give each report section a distinct lens so the report does not restate the same conclusion with different adjectives.
4. Prefer interpretation over scoring, generic labels, or personality judgments.

## Section Rules

- `summaryOneLiner` and `persona` use a short "domain + action + distinctive trait" structure. Generic labels such as "challenging", "high-growth", "global mindset", or "strong execution" are prohibited.
- `hashtags` prioritize industry, project, role, and technology. Only one or two abstract capability tags may appear.
- `strengths` explain the evidence that creates the impression rather than listing competencies.
- `gaps` begin by recognizing what already works, describe the missing link, and offer a concrete way to make the existing strength clearer.
- `subtitleDiagnosis` retains literary or story-led wording when it is clear, readable, and connected to the role. Suggestions refine clarity rather than mechanically inserting a role title.
- `feedbackCards` follow: recognition -> reason it works -> missing element -> practical refinement. They avoid dismissive phrasing.
- `detailedAnalysis` contains at least three distinct lenses from rationale, logical structure, company-side reading, cross-experience connection, differentiation, likely interview question, and improvement direction.
- `pmComment` uses the same editorial interpretation: it names the applicant's through-line, identifies the most consequential missing evidence, and recommends a focused revision.

## Guardrails

- JSON keys, types, cardinality constraints, language rules, highlighting requirements, and context-irrelevant response remain unchanged.
- Avoid repeated stock evaluations: logical, strong execution, high growth potential, passionate, suitable.
- Do not use the same adjective or verdict as the principal explanation across sections.
- Metaphor and storytelling remain when they are clear, readable, and connected to the target role.

## Verification

Add a prompt contract test that confirms the source remains singular and that the canonical prompt contains the editorial pattern, section-specific rules, and anti-repetition guardrail. Run the focused prompt test and the existing report persistence/identity tests.
