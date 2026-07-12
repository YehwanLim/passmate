# Admin Prompts Management Design

## Goal

Allow PassMate operators to manage AI prompt content and configuration without editing application code. The playground is intentionally mocked and never calls an AI provider.

## Scope

- Add `Prompts` to the admin sidebar and route it to `/admin/prompts`.
- Show five prompt types: Resume Analysis, Cover Letter, Summary, Feedback, and Interview Questions.
- Provide a detail route at `/admin/prompts/:type` with editing, version history, activation, rollback, and a mock playground.
- Store prompt versions in the existing `prompt_templates` table.

## Data model

The prompt template schema will be extended with:

- `prompt_type`: stable identifier for one of the five prompt types.
- `notes`: operator notes for a version.
- `updated_by`: email or display name of the operator who created the version.
- `updated_at`: last modification time for metadata.

The unique version identity is `(prompt_type, version)`. `version` uses `v<major>.<minor>` and saves increment the minor number. One prompt type can have at most one active version. `is_active` is the active flag; inactive versions are drafts or historical versions.

## Operator workflows

### Save draft

Saving never overwrites an existing version. The system copies the current editor values into a new record with the next version number and `is_active = false`.

### Activate

Activating a draft first deactivates every version with the same prompt type, then marks the selected version active. Other prompt types are unchanged.

### Rollback

Rollback copies an earlier version into the editor and saves it as a new draft version. The operator must explicitly activate it. Historical records are never modified or deleted.

## UI

The list page uses the established PassMate admin card styling. Each card displays the prompt type, name, active/latest version, updated time, editor, and status.

The detail page uses a responsive two-column layout: an editor and version history on the left, and a mock playground on the right. The editor provides textareas for system prompt and user prompt template, plus input controls for name, temperature, max tokens, and notes.

The playground accepts resume content and generates a deterministic mock response with mock response time, token count, and estimated cost. It does not contact OpenAI, Gemini, or any external model provider.

## Error handling

- Missing prompt records are initialized from local defaults only when the admin explicitly creates/saves a first draft.
- Database failures remain visible in the UI and do not alter local version state.
- An activation failure leaves the previous active version unchanged.

## Verification

- Unit tests cover version incrementing and the one-active-version update payload.
- Type checking verifies the client build.
- Manual local verification confirms the list, editor, draft save, activation, rollback, and mock playground flow.
