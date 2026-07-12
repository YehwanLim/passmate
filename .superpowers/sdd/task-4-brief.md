### Task 4: Prompt editor, history, and activation controls

**Files:**
- Create: `client/src/pages/admin/prompts/PromptDetailPage.tsx`
- Modify: `client/src/pages/admin/AdminRoot.tsx`

**Interfaces:**
- Consumes `usePrompts()`, `PromptType`, `PromptTemplateRecord`.
- Produces route `/admin/prompts/:type` and editor actions `Save Draft`, `Activate`, and `Rollback`.

- [ ] **Step 1: Add the detail route before the collection route**

```tsx
<Route path="/admin/prompts/:type" component={PromptDetailPage} />
<Route path="/admin/prompts" component={PromptsPage} />
```

- [ ] **Step 2: Implement the editor and version history**

```tsx
<div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.85fr)]">
  <Card>{/* Name, System Prompt textarea, User Prompt textarea, Temperature, Max Tokens, Notes */}</Card>
  <Card>{/* Version History with Active badge, Activate and Rollback buttons */}</Card>
</div>
```

Use the existing `Textarea`, `Input`, `Label`, `Button`, `Badge`, `Card`, and `Alert` components. The prompt textareas need monospaced text, a minimum 240px height, and labels that describe available interpolation such as `{{resume}}`.

Save Draft disables itself during the insert. Activate only appears on inactive historical versions. Rollback pre-fills the editor with the historical contents and shows a notice that saving creates a new Draft; it must not automatically activate the copied version.

- [ ] **Step 3: Verify the draft and activation behavior locally**

Run: `pnpm check`

Expected: no new TypeScript errors from the detail page.

Manual checks: save a Draft, verify a new version appears as Draft; activate it, verify the earlier same-type active badge clears; select Rollback, save the populated contents, and verify it creates another Draft.

- [ ] **Step 4: Commit the editor and history**

```bash
git add client/src/pages/admin/prompts/PromptDetailPage.tsx client/src/pages/admin/AdminRoot.tsx
git commit -m "feat: add prompt editor and version history"
```

