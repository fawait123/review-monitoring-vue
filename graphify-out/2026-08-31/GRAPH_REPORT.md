# Graph Report - .  (2026-08-31)

## Corpus Check
- Corpus is ~29,368 words - fits in a single context window. You may not need a graph.

## Summary
- 692 nodes · 970 edges · 53 communities (46 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Server API & DB Layer|Server API & DB Layer]]
- [[_COMMUNITY_AI Review Pipeline|AI Review Pipeline]]
- [[_COMMUNITY_Analytics Charts|Analytics Charts]]
- [[_COMMUNITY_Dependencies|Dependencies]]
- [[_COMMUNITY_Button & Dialog UI|Button & Dialog UI]]
- [[_COMMUNITY_Select UI|Select UI]]
- [[_COMMUNITY_Diff Comment Composer|Diff Comment Composer]]
- [[_COMMUNITY_Sheet UI|Sheet UI]]
- [[_COMMUNITY_Sidebar Core|Sidebar Core]]
- [[_COMMUNITY_Sidebar Structure|Sidebar Structure]]
- [[_COMMUNITY_Table UI|Table UI]]
- [[_COMMUNITY_Tabs UI|Tabs UI]]
- [[_COMMUNITY_Dashboard Page|Dashboard Page]]
- [[_COMMUNITY_Card UI|Card UI]]
- [[_COMMUNITY_Tooltip UI|Tooltip UI]]
- [[_COMMUNITY_GitHub Auth (Device OAuth)|GitHub Auth (Device OAuth)]]
- [[_COMMUNITY_Sidebar Provider|Sidebar Provider]]
- [[_COMMUNITY_PR Detail Page|PR Detail Page]]
- [[_COMMUNITY_PR Table & Badges|PR Table & Badges]]
- [[_COMMUNITY_Collapsible UI|Collapsible UI]]
- [[_COMMUNITY_Dropdown Menu Trigger|Dropdown Menu Trigger]]
- [[_COMMUNITY_Sidebar Menu Button|Sidebar Menu Button]]
- [[_COMMUNITY_Model Config Composable|Model Config Composable]]
- [[_COMMUNITY_Input UI|Input UI]]
- [[_COMMUNITY_Scroll Area UI|Scroll Area UI]]
- [[_COMMUNITY_Skeleton UI|Skeleton UI]]
- [[_COMMUNITY_Diff Parser & Clamp|Diff Parser & Clamp]]
- [[_COMMUNITY_Checkbox UI|Checkbox UI]]
- [[_COMMUNITY_Separator UI|Separator UI]]
- [[_COMMUNITY_Layout & Nav|Layout & Nav]]
- [[_COMMUNITY_App Config|App Config]]
- [[_COMMUNITY_Gh Status Button & Auth|Gh Status Button & Auth]]
- [[_COMMUNITY_Badge UI|Badge UI]]
- [[_COMMUNITY_Dropdown Checkbox Item|Dropdown Checkbox Item]]
- [[_COMMUNITY_Dropdown Content|Dropdown Content]]
- [[_COMMUNITY_Dropdown Radio Item|Dropdown Radio Item]]
- [[_COMMUNITY_Dropdown Sub Content|Dropdown Sub Content]]
- [[_COMMUNITY_Textarea UI|Textarea UI]]
- [[_COMMUNITY_Analytics KPIs|Analytics KPIs]]
- [[_COMMUNITY_Dropdown Menu Root|Dropdown Menu Root]]
- [[_COMMUNITY_Dropdown Item|Dropdown Item]]
- [[_COMMUNITY_Dropdown Label|Dropdown Label]]
- [[_COMMUNITY_Dropdown Radio Group|Dropdown Radio Group]]
- [[_COMMUNITY_Dropdown Sub|Dropdown Sub]]
- [[_COMMUNITY_Dropdown Sub Trigger|Dropdown Sub Trigger]]
- [[_COMMUNITY_Sonner Toast|Sonner Toast]]
- [[_COMMUNITY_PR List Page|PR List Page]]
- [[_COMMUNITY_Review Decision Badge|Review Decision Badge]]
- [[_COMMUNITY_Dropdown Separator|Dropdown Separator]]
- [[_COMMUNITY_TS Project Config|TS Project Config]]

## God Nodes (most connected - your core abstractions)
1. `db()` - 37 edges
2. `runReview (Pi agent review runner)` - 22 edges
3. `getAnalyticsData (dashboard analytics queries)` - 11 edges
4. `gh()` - 10 edges
5. `reviews/run.post SSE handler (per-file streaming review)` - 9 edges
6. `getReview()` - 9 edges
7. `scripts` - 8 edges
8. `tailwind` - 6 edges
9. `aliases` - 6 edges
10. `start()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Review Monitor README (features, setup)` --cites--> `Drizzle pg schema (repos, prs, reviews, comments, model_config)`  [INFERRED]
  README.md → server/services/db/schema.ts
- `Next.js → Nuxt + PostgreSQL + Drizzle migration plan` --cites--> `Drizzle pg schema (repos, prs, reviews, comments, model_config)`  [EXTRACTED]
  PLAN.md → server/services/db/schema.ts
- `start()` --calls--> `parseDiff (unified diff parser)`  [INFERRED]
  server/api/reviews/run.post.ts → shared/diff-parser.ts
- `Next.js → Nuxt + PostgreSQL + Drizzle migration plan` --cites--> `nuxt.config.ts (ui auto-import, color-mode, nitro externals)`  [EXTRACTED]
  PLAN.md → nuxt.config.ts
- `reviews/run.post SSE handler (per-file streaming review)` --references--> `clampToHunkLine (clamp comment line to diff)`  [EXTRACTED]
  server/api/reviews/run.post.ts → shared/diff-parser.ts

## Import Cycles
- 3-file cycle: `app/components/ui/sidebar/SidebarMenuButton.vue -> app/components/ui/sidebar/SidebarMenuButtonChild.vue -> app/components/ui/sidebar/index.ts -> app/components/ui/sidebar/SidebarMenuButton.vue`

## Hyperedges (group relationships)
- **AI Code Review Pipeline** — server_api_reviews_run_post_sse, server_services_review_runner_runreview, server_services_review_prompt_reviewsystemprompt, shared_diff_parser_parsediff, concept_pi_agent [INFERRED 0.85]
- **Model Configuration Flow** — server_config_models_modelsjson, model_configpaths_configpaths, db_modelconfig_getmodelconfig, server_services_review_runner_runreview [INFERRED 0.85]
- **GitHub Integration** — server_services_github_gha_gh, server_services_ghauth_getghstatus, server_services_ghauth_startghlogin, concept_device_oauth [INFERRED 0.85]

## Communities (53 total, 7 thin omitted)

### Community 0 - "Server API & DB Layer"
Cohesion: 0.06
Nodes (63): start(), getAnalyticsData (dashboard analytics queries), perAuthorQuery(), perRepoQuery(), repoCountQuery(), reviewStatsQuery(), stateRatioQuery(), totalQuery() (+55 more)

### Community 1 - "AI Review Pipeline"
Cohesion: 0.07
Nodes (38): useReview composable (SSE client, review state), App-owned pi config (server/config) not ~/.pi/agent, AI JSON output auto-repair (truncation, trailing comma), Line clamping to prevent wrong GitHub comment lines, Per-file review mode (one AI review per diff file), Pi Coding Agent SDK (@earendil-works/pi-coding-agent), Server-Sent Events live review streaming, Transient API error retry (rate limit, 403, 429) (+30 more)

### Community 2 - "Analytics Charts"
Cohesion: 0.05
Nodes (38): option, props, ready, option, props, ready, option, props (+30 more)

### Community 3 - "Dependencies"
Cohesion: 0.05
Nodes (39): dependencies, class-variance-authority, clsx, drizzle-orm, @earendil-works/pi-coding-agent, @lucide/vue, nuxt, @nuxtjs/color-mode (+31 more)

### Community 4 - "Button & Dialog UI"
Cohesion: 0.06
Nodes (25): Props, ButtonVariants, emits, forwarded, props, props, delegatedProps, emits (+17 more)

### Community 5 - "Select UI"
Cohesion: 0.05
Nodes (26): emits, forwarded, props, delegatedProps, emits, forwarded, props, delegatedProps (+18 more)

### Community 6 - "Diff Comment Composer"
Cohesion: 0.06
Nodes (26): body, emit, handleSave(), props, textareaRef, props, commentsByLine, composer (+18 more)

### Community 7 - "Sheet UI"
Cohesion: 0.07
Nodes (18): emits, forwarded, props, props, delegatedProps, emits, forwarded, props (+10 more)

### Community 8 - "Sidebar Core"
Cohesion: 0.09
Nodes (14): SidebarProps, { isMobile, state, openMobile, setOpenMobile }, props, props, props, props, props, props (+6 more)

### Community 9 - "Sidebar Structure"
Cohesion: 0.10
Nodes (9): props, props, props, props, props, props, props, props (+1 more)

### Community 10 - "Table UI"
Cohesion: 0.11
Nodes (10): props, props, props, props, delegatedProps, props, props, props (+2 more)

### Community 11 - "Tabs UI"
Cohesion: 0.12
Nodes (12): TabsListVariants, delegatedProps, emits, forwarded, props, delegatedProps, props, delegatedProps (+4 more)

### Community 12 - "Dashboard Page"
Cohesion: 0.12
Nodes (15): { data, error }, AnalyticsData, AuthorBreakdown, CollectedPR, CommentStatus, PR, PRState, Repo (+7 more)

### Community 13 - "Card UI"
Cohesion: 0.13
Nodes (7): props, props, props, props, props, props, props

### Community 14 - "Tooltip UI"
Cohesion: 0.14
Nodes (9): emits, forwarded, props, delegatedProps, emits, forwarded, props, props (+1 more)

### Community 15 - "GitHub Auth (Device OAuth)"
Cohesion: 0.26
Nodes (7): GitHub Device OAuth flow via gh CLI, cancelGhLogin(), exec, getGhStatus (gh auth status), GhStatus, startGhLogin (device OAuth flow), gh CLI GitHub integration (execFile)

### Community 16 - "Sidebar Provider"
Cohesion: 0.24
Nodes (9): emits, isMobile, open, openMobile, props, setOpen(), setOpenMobile(), state (+1 more)

### Community 17 - "PR Detail Page"
Cohesion: 0.20
Nodes (9): commentsByReview, { data, pending, error, refresh }, files, number, owner, PrDetailData, repo, reviews (+1 more)

### Community 18 - "PR Table & Badges"
Cohesion: 0.25
Nodes (5): map, props, emit, handleStateChange(), props

### Community 19 - "Collapsible UI"
Cohesion: 0.22
Nodes (5): emits, forwarded, props, props, props

### Community 20 - "Dropdown Menu Trigger"
Cohesion: 0.25
Nodes (4): props, props, forwardedProps, props

### Community 21 - "Sidebar Menu Button"
Cohesion: 0.32
Nodes (6): SidebarMenuButtonVariants, delegatedProps, { isMobile, state }, props, props, SidebarMenuButtonProps

### Community 22 - "Model Config Composable"
Cohesion: 0.25
Nodes (5): CatalogModel, CatalogProvider, SavedModelConfig, THINKING_LEVELS, {
  providers,
  modelOptions,
  providerId,
  modelId,
  thinkingLevel,
  saved,
  loading,
  saving,
  thinkingLevels,
  save,
}

### Community 23 - "Input UI"
Cohesion: 0.29
Nodes (4): emits, modelValue, props, props

### Community 24 - "Scroll Area UI"
Cohesion: 0.33
Nodes (4): delegatedProps, props, delegatedProps, props

### Community 25 - "Skeleton UI"
Cohesion: 0.29
Nodes (4): props, width, props, SkeletonProps

### Community 26 - "Diff Parser & Clamp"
Cohesion: 0.33
Nodes (6): clampToHunkLine (clamp comment line to diff), hunkLineRanges (diff new-line numbers), DiffFile, DiffHunk, DiffLine, DiffLineKind

### Community 27 - "Checkbox UI"
Cohesion: 0.33
Nodes (4): delegatedProps, emits, forwarded, props

### Community 28 - "Separator UI"
Cohesion: 0.33
Nodes (3): delegatedProps, props, props

### Community 29 - "Layout & Nav"
Cohesion: 0.33
Nodes (3): colorMode, nav, route

### Community 30 - "App Config"
Cohesion: 0.33
Nodes (3): eslintConfig, AppConfig, DEFAULTS

### Community 32 - "Badge UI"
Cohesion: 0.50
Nodes (3): delegatedProps, props, BadgeVariants

### Community 33 - "Dropdown Checkbox Item"
Cohesion: 0.40
Nodes (4): delegatedProps, emits, forwarded, props

### Community 34 - "Dropdown Content"
Cohesion: 0.40
Nodes (4): delegatedProps, emits, forwarded, props

### Community 35 - "Dropdown Radio Item"
Cohesion: 0.40
Nodes (4): delegatedProps, emits, forwarded, props

### Community 36 - "Dropdown Sub Content"
Cohesion: 0.40
Nodes (4): delegatedProps, emits, forwarded, props

### Community 37 - "Textarea UI"
Cohesion: 0.40
Nodes (3): emits, modelValue, props

### Community 39 - "Dropdown Menu Root"
Cohesion: 0.50
Nodes (3): emits, forwarded, props

### Community 40 - "Dropdown Item"
Cohesion: 0.50
Nodes (3): delegatedProps, forwardedProps, props

### Community 41 - "Dropdown Label"
Cohesion: 0.50
Nodes (3): delegatedProps, forwardedProps, props

### Community 42 - "Dropdown Radio Group"
Cohesion: 0.50
Nodes (3): emits, forwarded, props

### Community 43 - "Dropdown Sub"
Cohesion: 0.50
Nodes (3): emits, forwarded, props

### Community 44 - "Dropdown Sub Trigger"
Cohesion: 0.50
Nodes (3): delegatedProps, forwardedProps, props

## Knowledge Gaps
- **363 isolated node(s):** `{
  status,
  dialogOpen,
  busy,
  loginCode,
  loginUrl,
  connect,
  cancelConnect,
  disconnect,
}`, `props`, `kpis`, `props`, `ready` (+358 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `runReview (Pi agent review runner)` connect `AI Review Pipeline` to `Server API & DB Layer`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `reviews/run.post SSE handler (per-file streaming review)` connect `AI Review Pipeline` to `Server API & DB Layer`, `Diff Parser & Clamp`, `GitHub Auth (Device OAuth)`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `gh CLI GitHub integration (execFile)` connect `GitHub Auth (Device OAuth)` to `AI Review Pipeline`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `runReview (Pi agent review runner)` (e.g. with `App-owned pi config (server/config) not ~/.pi/agent` and `Line clamping to prevent wrong GitHub comment lines`) actually correct?**
  _`runReview (Pi agent review runner)` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{
  status,
  dialogOpen,
  busy,
  loginCode,
  loginUrl,
  connect,
  cancelConnect,
  disconnect,
}`, `props`, `kpis` to the rest of the system?**
  _363 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server API & DB Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.057181942544459644 - nodes in this community are weakly interconnected._
- **Should `AI Review Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.06767676767676768 - nodes in this community are weakly interconnected._