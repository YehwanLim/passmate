### Task 3: Prompts list page and admin navigation

**Files:**
- Create: `client/src/pages/admin/prompts/PromptsPage.tsx`
- Modify: `client/src/components/admin/layout/AdminSidebar.tsx`
- Modify: `client/src/pages/admin/AdminRoot.tsx`

**Interfaces:**
- Consumes `PROMPT_TYPES` and `usePrompts()`.
- Produces route `/admin/prompts` and links each card to `/admin/prompts/:type`.

- [ ] **Step 1: Add the route before writing the page**

```tsx
import PromptsPage from "./prompts/PromptsPage";

<Route path="/admin/prompts" component={PromptsPage} />
```

Add a `Prompts` Management menu item using `MessageSquareCode` from Lucide, immediately after `AI Models`.

- [ ] **Step 2: Implement the responsive list page**

```tsx
<AdminPageHeader
  title="Prompts"
  description="AI 프롬프트를 버전별로 검토하고 운영 버전을 관리합니다."
/>
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
  {promptTypes.map((type) => (
    <Card key={type.key} className="transition-shadow hover:shadow-md">
      {/* type, prompt name, version, updated time/by, and Active or Draft badge */}
    </Card>
  ))}
</div>
```

Use local default metadata only for empty types; do not insert seed records while viewing the page. Show an error alert when the repository fails to load.

- [ ] **Step 3: Verify routing and type-checking**

Run: `pnpm check`

Expected: no new errors from `PromptsPage`, `AdminSidebar`, or `AdminRoot`. Record any pre-existing failures separately.

- [ ] **Step 4: Commit the list page and navigation**

```bash
git add client/src/pages/admin/prompts/PromptsPage.tsx client/src/components/admin/layout/AdminSidebar.tsx client/src/pages/admin/AdminRoot.tsx
git commit -m "feat: add admin prompts list"
```

