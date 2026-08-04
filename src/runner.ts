/**
 * Workflow step runner.
 * Triggers on domain events (OrderPaid) and executes registered actions.
 */

import { getWorkflowAction } from './actions.js';
import {
  listActiveWorkflowsForEvent,
  type WorkflowDefinition,
  type WorkflowStep,
} from './definitions.js';

export type WorkflowRunStatus = 'completed' | 'failed' | 'waiting_delay' | 'waiting_approval';

export type WorkflowStepResult = {
  index: number;
  type: WorkflowStep['type'];
  status: 'completed' | 'failed' | 'waiting';
  action?: string;
  error?: string;
};

export type WorkflowRun = {
  id: string;
  workflowCode: string;
  triggerEvent: string;
  aggregateId: string;
  status: WorkflowRunStatus;
  stepResults: WorkflowStepResult[];
  context: Record<string, unknown>;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
};

export type DomainEventLike = {
  eventName: string;
  aggregateId: string;
  data: unknown;
  eventId?: string;
};

const runs: WorkflowRun[] = [];
let runSeq = 1;

export function resetWorkflowRunsForTests(): void {
  runs.length = 0;
  runSeq = 1;
}

export function listWorkflowRuns(): WorkflowRun[] {
  return [...runs];
}

export async function runWorkflow(
  definition: WorkflowDefinition,
  event: DomainEventLike,
): Promise<WorkflowRun> {
  const run: WorkflowRun = {
    id: `run-${runSeq++}`,
    workflowCode: definition.code,
    triggerEvent: event.eventName,
    aggregateId: event.aggregateId,
    status: 'completed',
    stepResults: [],
    context: {
      eventId: event.eventId,
      eventData: event.data,
    },
    startedAt: new Date(),
    finishedAt: null,
    error: null,
  };

  for (let index = 0; index < definition.steps.length; index += 1) {
    const step = definition.steps[index]!;
    try {
      if (step.type === 'action') {
        const reg = getWorkflowAction(step.action);
        if (!reg) {
          throw new Error(`Unknown workflow action: ${step.action}`);
        }
        await reg.handler({
          workflowCode: definition.code,
          runId: run.id,
          eventName: event.eventName,
          aggregateId: event.aggregateId,
          data: event.data,
          params: step.params ?? {},
          context: run.context,
        });
        run.stepResults.push({
          index,
          type: 'action',
          status: 'completed',
          action: step.action,
        });
        continue;
      }

      if (step.type === 'delay') {
        // Foundation stub — durable delay via jobs queue lands in a later tick.
        run.stepResults.push({
          index,
          type: 'delay',
          status: 'waiting',
        });
        run.status = 'waiting_delay';
        run.finishedAt = new Date();
        runs.push(run);
        return run;
      }

      if (step.type === 'approval') {
        run.stepResults.push({
          index,
          type: 'approval',
          status: 'waiting',
        });
        run.status = 'waiting_approval';
        run.finishedAt = new Date();
        runs.push(run);
        return run;
      }

      const _exhaustive: never = step;
      throw new Error(`Unsupported step: ${JSON.stringify(_exhaustive)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      run.stepResults.push({
        index,
        type: step.type,
        status: 'failed',
        action: step.type === 'action' ? step.action : undefined,
        error: message,
      });
      run.status = 'failed';
      run.error = message;
      run.finishedAt = new Date();
      runs.push(run);
      return run;
    }
  }

  run.finishedAt = new Date();
  runs.push(run);
  return run;
}

/**
 * Find active workflows for the event and run each to completion (or wait stub).
 */
export async function handleTriggerEvent(event: DomainEventLike): Promise<WorkflowRun[]> {
  const defs = await listActiveWorkflowsForEvent(event.eventName);
  const results: WorkflowRun[] = [];
  for (const def of defs) {
    results.push(await runWorkflow(def, event));
  }
  return results;
}
