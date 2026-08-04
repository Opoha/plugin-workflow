import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MIGRATIONS_TABLE_NAME, PLUGIN_ID, entities, migrations } from './database.js';
import plugin, {
  ORDER_PAID_EVENT,
  getWorkflowAction,
  handleTriggerEvent,
  listWorkflowActions,
  listWorkflowRuns,
  registerWorkflowAction,
  resetWorkflowActionsForTests,
  resetWorkflowDefinitionsForTests,
  resetWorkflowRunsForTests,
  upsertWorkflowDefinition,
} from './index.js';
import { WorkflowInit1754300400000 } from './migrations/1754300400000-WorkflowInit.js';
import { createStubPluginContext } from '@opoha/plugin-sdk';

function mockPluginContext() {
  const providers: Array<{ token: string }> = [];
  const graphql: Array<{ name: string; kind: string }> = [];
  const listeners: Array<{ eventName: string; id?: string }> = [];
  return {
    providers,
    graphql,
    listeners,
    ctx: createStubPluginContext('workflow', {
      registerProvider: (input: { token: string }) => {
        providers.push({ token: input.token });
      },
      registerGraphQL: (input: { name: string; kind: string }) => {
        graphql.push({ name: input.name, kind: input.kind });
      },
      registerListener: (eventName: string, _handler: unknown, options?: { id?: string }) => {
        listeners.push({ eventName, id: options?.id });
      },
      registerAdmin: () => undefined,
      registerPaymentProvider: () => undefined,
      registerShippingMethod: () => undefined,
      registerTaxProvider: () => undefined,
      registerPromotionRuleProvider: () => undefined,
      registerNotificationProvider: () => undefined,
      registerStorageAdapter: () => undefined,
      registerSearchProvider: () => undefined,
      registerFXProvider: () => undefined,
      registerScheduledJob: () => undefined,
    }),
  };
}

describe('@opoha/plugin-workflow', () => {
  beforeEach(async () => {
    resetWorkflowActionsForTests();
    resetWorkflowDefinitionsForTests();
    resetWorkflowRunsForTests();
    // Boot registers built-in `workflow.log` (idempotent).
    const { ctx } = mockPluginContext();
    await plugin.boot?.(ctx);
  });

  it('exports a definePlugin definition with the expected id (B-01)', () => {
    expect(plugin.id).toBe('workflow');
    expect(typeof plugin.boot).toBe('function');
  });

  it('registers engine provider, OrderPaid listener, and GraphQL on boot', async () => {
    const { ctx, providers, graphql, listeners } = mockPluginContext();
    await plugin.boot?.(ctx);

    expect(providers.map((p) => p.token)).toEqual(
      expect.arrayContaining(['workflow.ready', 'workflow.engine']),
    );
    expect(listeners).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: ORDER_PAID_EVENT,
          id: 'plugin-workflow.order-paid',
        }),
      ]),
    );
    expect(graphql.map((g) => g.name)).toEqual(
      expect.arrayContaining(['workflowDefinitions', 'upsertWorkflowDefinition', 'workflowRuns']),
    );
  });

  it('exposes plugin-owned TypeORM entities and migrations (B-02)', () => {
    expect(PLUGIN_ID).toBe('workflow');
    expect(MIGRATIONS_TABLE_NAME).toBe('opoha_migrations_workflow');
    expect(entities).toHaveLength(2);
    expect(migrations).toHaveLength(1);
    expect(migrations[0]).toBe(WorkflowInit1754300400000);
  });

  it('runs WorkflowInit migration SQL against a query runner', async () => {
    const queries: string[] = [];
    const runner = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
      }),
    };
    const migration = new WorkflowInit1754300400000();
    await migration.up(runner as never);
    expect(queries.some((q) => q.includes('plugin_workflow_definitions'))).toBe(true);
    expect(queries.some((q) => q.includes('plugin_workflow_runs'))).toBe(true);
    await migration.down(runner as never);
    expect(queries.some((q) => q.includes('DROP TABLE'))).toBe(true);
  });

  describe('action registration API (B-03)', () => {
    it('registers a custom action without core patches', async () => {
      const seen: string[] = [];
      registerWorkflowAction('custom.tag', async (ctx) => {
        seen.push(String((ctx.data as { orderId?: string }).orderId));
        ctx.context.tagged = true;
      });

      expect(getWorkflowAction('custom.tag')).toBeDefined();
      expect(listWorkflowActions().map((a) => a.name)).toEqual(
        expect.arrayContaining(['workflow.log', 'custom.tag']),
      );

      await upsertWorkflowDefinition({
        code: 'on-order-paid',
        name: 'On order paid',
        triggerEvent: ORDER_PAID_EVENT,
        steps: [
          { type: 'action', action: 'custom.tag' },
          { type: 'action', action: 'workflow.log', params: { note: 'done' } },
        ],
      });

      const runs = await handleTriggerEvent({
        eventName: ORDER_PAID_EVENT,
        aggregateId: '11111111-1111-1111-1111-111111111111',
        eventId: '22222222-2222-2222-2222-222222222222',
        data: {
          orderId: '11111111-1111-1111-1111-111111111111',
          paymentId: 'pay-1',
        },
      });

      expect(runs).toHaveLength(1);
      expect(runs[0]!.status).toBe('completed');
      expect(runs[0]!.stepResults).toHaveLength(2);
      expect(seen).toEqual(['11111111-1111-1111-1111-111111111111']);
      expect(runs[0]!.context.tagged).toBe(true);
      expect(runs[0]!.context.lastLog).toEqual(
        expect.objectContaining({
          aggregateId: '11111111-1111-1111-1111-111111111111',
          eventName: ORDER_PAID_EVENT,
        }),
      );
      expect(listWorkflowRuns()).toHaveLength(1);
    });

    it('rejects duplicate action registration', () => {
      registerWorkflowAction('once', async () => undefined);
      expect(() => registerWorkflowAction('once', async () => undefined)).toThrow(
        /already registered/,
      );
    });
  });

  describe('runner (B-02)', () => {
    it('fails when an action is missing', async () => {
      await upsertWorkflowDefinition({
        code: 'broken',
        name: 'Broken',
        steps: [{ type: 'action', action: 'missing.action' }],
      });
      const [run] = await handleTriggerEvent({
        eventName: ORDER_PAID_EVENT,
        aggregateId: 'order-1',
        data: {},
      });
      expect(run!.status).toBe('failed');
      expect(run!.error).toMatch(/Unknown workflow action/);
    });

    it('stops at delay foundation stub', async () => {
      await upsertWorkflowDefinition({
        code: 'with-delay',
        name: 'With delay',
        steps: [
          { type: 'action', action: 'workflow.log' },
          { type: 'delay', ms: 1000 },
          { type: 'action', action: 'workflow.log' },
        ],
      });
      const [run] = await handleTriggerEvent({
        eventName: ORDER_PAID_EVENT,
        aggregateId: 'order-2',
        data: {},
      });
      expect(run!.status).toBe('waiting_delay');
      expect(run!.stepResults).toHaveLength(2);
    });
  });
});
