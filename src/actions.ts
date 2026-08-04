/**
 * Public workflow action registration API (Phase 8 B-03).
 * Plugin authors register handlers here — no core patches required.
 */

export type WorkflowActionContext = {
  /** Workflow definition code that invoked this action. */
  workflowCode: string;
  /** Current run id (stable for the trigger event). */
  runId: string;
  /** Triggering domain event name (e.g. OrderPaid). */
  eventName: string;
  /** Aggregate id from the domain event envelope. */
  aggregateId: string;
  /** Event payload `data` DTO. */
  data: unknown;
  /** Step params from the workflow definition. */
  params: Record<string, unknown>;
  /** Mutable run context shared across steps. */
  context: Record<string, unknown>;
};

export type WorkflowActionHandler = (ctx: WorkflowActionContext) => void | Promise<void>;

export type WorkflowActionRegistration = {
  name: string;
  displayName?: string;
  handler: WorkflowActionHandler;
};

const actions = new Map<string, WorkflowActionRegistration>();

export function registerWorkflowAction(
  name: string,
  handler: WorkflowActionHandler,
  options?: { displayName?: string },
): void {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Workflow action name is required');
  }
  if (actions.has(trimmed)) {
    throw new Error(`Workflow action already registered: ${trimmed}`);
  }
  actions.set(trimmed, {
    name: trimmed,
    displayName: options?.displayName,
    handler,
  });
}

export function getWorkflowAction(name: string): WorkflowActionRegistration | undefined {
  return actions.get(name);
}

export function listWorkflowActions(): WorkflowActionRegistration[] {
  return [...actions.values()];
}

export function resetWorkflowActionsForTests(): void {
  actions.clear();
}
