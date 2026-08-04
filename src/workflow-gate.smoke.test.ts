/**
 * Phase 8 B-04 — Workflow gate smoke.
 * `OrderPaid` (core `CoreEventName.OrderPaid` — see opoha-core event-catalog)
 * fires the plugin's registered listener, resolves the active workflow
 * definition for the trigger, and completes every defined step via the
 * public action registration API (B-03). No core patches required.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
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
import plugin from './index.js';
import { createStubPluginContext } from '@opoha/plugin-sdk';

function mockPluginContext() {
  const listeners = new Map<string, (event: unknown) => void | Promise<void>>();
  return {
    listeners,
    ctx: createStubPluginContext('workflow', {
      registerProvider: () => undefined,
      registerGraphQL: () => undefined,
      registerListener: (
        eventName: string,
        handler: (event: unknown) => void | Promise<void>,
        _options?: { id?: string },
      ) => {
        listeners.set(eventName, handler);
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

describe('Workflow gate smoke (B-04)', () => {
  beforeEach(() => {
    resetWorkflowActionsForTests();
    resetWorkflowDefinitionsForTests();
    resetWorkflowRunsForTests();
  });

  it('OrderPaid trigger completes every defined workflow step end-to-end', async () => {
    const { ctx, listeners } = mockPluginContext();
    await plugin.boot?.(ctx);

    expect(ORDER_PAID_EVENT).toBe('OrderPaid');
    const onOrderPaid = listeners.get(ORDER_PAID_EVENT);
    expect(onOrderPaid).toBeDefined();

    const tagged: string[] = [];
    const emailed: string[] = [];
    registerWorkflowAction('customer.tag', async (actionCtx) => {
      tagged.push(actionCtx.aggregateId);
    });
    registerWorkflowAction('notification.send', async (actionCtx) => {
      emailed.push(String((actionCtx.data as { orderId?: string }).orderId));
    });
    expect(listWorkflowActions().map((a) => a.name)).toEqual(
      expect.arrayContaining(['workflow.log', 'customer.tag', 'notification.send']),
    );

    await upsertWorkflowDefinition({
      code: 'post-purchase-followup',
      name: 'Post-purchase follow-up',
      triggerEvent: ORDER_PAID_EVENT,
      steps: [
        { type: 'action', action: 'customer.tag' },
        { type: 'action', action: 'notification.send' },
        { type: 'action', action: 'workflow.log', params: { note: 'sent' } },
      ],
    });

    const orderId = '33333333-3333-3333-3333-333333333333';
    // Core dispatches through the registered listener — this call is the
    // exact host-side integration point (ctx.registerListener callback).
    await onOrderPaid!({
      eventName: ORDER_PAID_EVENT,
      aggregateId: orderId,
      eventId: '44444444-4444-4444-4444-444444444444',
      data: { orderId, paymentId: 'pay-gate-smoke' },
    });

    const runs = listWorkflowRuns();
    expect(runs).toHaveLength(1);
    const run = runs[0]!;
    expect(run.status).toBe('completed');
    expect(run.workflowCode).toBe('post-purchase-followup');
    expect(run.stepResults).toHaveLength(3);
    expect(run.stepResults.every((s) => s.status === 'completed')).toBe(true);
    expect(tagged).toEqual([orderId]);
    expect(emailed).toEqual([orderId]);
    expect(getWorkflowAction('customer.tag')).toBeDefined();

    // Also verify the direct public-API path (no host event bus involved),
    // confirming the runner + action API work independent of the listener.
    const direct = await handleTriggerEvent({
      eventName: ORDER_PAID_EVENT,
      aggregateId: orderId,
      data: { orderId, paymentId: 'pay-gate-smoke-direct' },
    });
    expect(direct).toHaveLength(1);
    expect(direct[0]!.status).toBe('completed');
  });
});
