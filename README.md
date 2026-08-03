# Workflow Plugin

`@opoha/plugin-workflow` — multi-step workflow engine for Opoha Phase 8 (Automation).

ADR-0003 / contract `0.1`. Definitions and the step runner live in this plugin;
core provides the event bus (`OrderPaid` trigger) and jobs hooks for delay /
approval foundation stubs. Persistence uses **TypeORM only** (ADR-0010) with
plugin-owned tables (`plugin_workflow_*`).

## What it registers

| Token / API | Role |
|-------------|------|
| `workflow.ready` | Lifecycle readiness stub |
| `workflow.engine` | Definitions, runner, action registry, run list |
| Listener | `OrderPaid` → active workflows |
| GraphQL | `workflowDefinitions`, `upsertWorkflowDefinition`, `workflowRuns` |

## Public action API (B-03)

Plugin authors register actions **without core patches**:

```ts
import { registerWorkflowAction } from '@opoha/plugin-workflow';

registerWorkflowAction('my-plugin.notify', async (ctx) => {
  // ctx.data is the OrderPaid (or other) event payload DTO
  console.log(ctx.aggregateId, ctx.params);
});
```

Or via the host-bound provider token `workflow.engine.registerAction`.

## Define a workflow

```ts
import {
  ORDER_PAID_EVENT,
  upsertWorkflowDefinition,
} from '@opoha/plugin-workflow';

await upsertWorkflowDefinition({
  code: 'fulfill-on-paid',
  name: 'Fulfill on paid',
  triggerEvent: ORDER_PAID_EVENT,
  steps: [
    { type: 'action', action: 'my-plugin.notify', params: { channel: 'ops' } },
    { type: 'action', action: 'workflow.log' },
  ],
});
```

## TypeORM (plugin-owned)

```ts
import {
  entities,
  migrations,
  MIGRATIONS_TABLE_NAME,
} from '@opoha/plugin-workflow/database';
```

Tables: `plugin_workflow_definitions`, `plugin_workflow_runs`.
Migrations table: `opoha_migrations_workflow`.

## Load

```bash
pnpm install && pnpm build
export OPOHA_PLUGINS="$(pwd)"
```

Core discovers via `OPOHA_PLUGINS` / `OPOHA_PLUGINS_PATH` and dynamically
imports `dist/index.js` — core never statically imports this package.

## Develop

```bash
pnpm install
pnpm build
pnpm test
```

See [Phase 8 work plan](../opoha-workspace/docs/plans/20260804-phase-08-automation.md).
