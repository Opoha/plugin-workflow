/**
 * Workflow definition model (Phase 8 B-02).
 * Declarative JSON steps; persistence via in-memory store or TypeORM bind.
 */

export const ORDER_PAID_EVENT = 'OrderPaid' as const;

export type WorkflowActionStep = {
  type: 'action';
  action: string;
  params?: Record<string, unknown>;
};

/** Delay foundation stub — runner records a waiting state (jobs hook later). */
export type WorkflowDelayStep = {
  type: 'delay';
  ms: number;
};

/** Human approval foundation stub. */
export type WorkflowApprovalStep = {
  type: 'approval';
  label: string;
};

export type WorkflowStep = WorkflowActionStep | WorkflowDelayStep | WorkflowApprovalStep;

export type WorkflowDefinition = {
  id: string;
  code: string;
  name: string;
  /** Domain event that starts this workflow (e.g. OrderPaid). */
  triggerEvent: string;
  steps: WorkflowStep[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertWorkflowDefinitionInput = {
  code: string;
  name: string;
  triggerEvent?: string;
  steps: WorkflowStep[];
  isActive?: boolean;
  id?: string;
};

let nextId = 1;
const definitions = new Map<string, WorkflowDefinition>();

export type WorkflowDefinitionsStore = {
  upsert(input: UpsertWorkflowDefinitionInput): Promise<WorkflowDefinition>;
  findByCode(code: string): Promise<WorkflowDefinition | null>;
  listActiveByTrigger(eventName: string): Promise<WorkflowDefinition[]>;
  list(): Promise<WorkflowDefinition[]>;
  remove(code: string): Promise<boolean>;
};

let boundStore: WorkflowDefinitionsStore | null = null;

function memoryStore(): WorkflowDefinitionsStore {
  return {
    async upsert(input) {
      const existing = definitions.get(input.code);
      const now = new Date();
      const def: WorkflowDefinition = {
        id: input.id ?? existing?.id ?? `wf-${nextId++}`,
        code: input.code,
        name: input.name,
        triggerEvent: input.triggerEvent ?? ORDER_PAID_EVENT,
        steps: input.steps,
        isActive: input.isActive ?? true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      definitions.set(def.code, def);
      return def;
    },
    async findByCode(code) {
      return definitions.get(code) ?? null;
    },
    async listActiveByTrigger(eventName) {
      return [...definitions.values()].filter((d) => d.isActive && d.triggerEvent === eventName);
    },
    async list() {
      return [...definitions.values()];
    },
    async remove(code) {
      return definitions.delete(code);
    },
  };
}

export function bindWorkflowDefinitionsStore(store: WorkflowDefinitionsStore | null): void {
  boundStore = store;
}

export function getWorkflowDefinitionsStore(): WorkflowDefinitionsStore {
  return boundStore ?? memoryStore();
}

export async function upsertWorkflowDefinition(
  input: UpsertWorkflowDefinitionInput,
): Promise<WorkflowDefinition> {
  if (!input.code.trim()) {
    throw new Error('Workflow definition code is required');
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new Error('Workflow definition requires at least one step');
  }
  return getWorkflowDefinitionsStore().upsert(input);
}

export async function listWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
  return getWorkflowDefinitionsStore().list();
}

export async function listActiveWorkflowsForEvent(
  eventName: string,
): Promise<WorkflowDefinition[]> {
  return getWorkflowDefinitionsStore().listActiveByTrigger(eventName);
}

export function resetWorkflowDefinitionsForTests(): void {
  definitions.clear();
  nextId = 1;
  boundStore = null;
}
