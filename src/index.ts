import { definePlugin } from '@opoha/plugin-sdk';

import {
  getWorkflowAction,
  listWorkflowActions,
  registerWorkflowAction,
  resetWorkflowActionsForTests,
  type WorkflowActionContext,
  type WorkflowActionHandler,
  type WorkflowActionRegistration,
} from './actions.js';
import {
  ORDER_PAID_EVENT,
  bindWorkflowDefinitionsStore,
  listActiveWorkflowsForEvent,
  listWorkflowDefinitions,
  resetWorkflowDefinitionsForTests,
  upsertWorkflowDefinition,
  type UpsertWorkflowDefinitionInput,
  type WorkflowDefinition,
  type WorkflowDefinitionsStore,
  type WorkflowStep,
} from './definitions.js';
import {
  handleTriggerEvent,
  listWorkflowRuns,
  resetWorkflowRunsForTests,
  runWorkflow,
  type DomainEventLike,
  type WorkflowRun,
  type WorkflowRunStatus,
  type WorkflowStepResult,
} from './runner.js';

export {
  ORDER_PAID_EVENT,
  bindWorkflowDefinitionsStore,
  getWorkflowAction,
  handleTriggerEvent,
  listActiveWorkflowsForEvent,
  listWorkflowActions,
  listWorkflowDefinitions,
  listWorkflowRuns,
  registerWorkflowAction,
  resetWorkflowActionsForTests,
  resetWorkflowDefinitionsForTests,
  resetWorkflowRunsForTests,
  runWorkflow,
  upsertWorkflowDefinition,
  type DomainEventLike,
  type UpsertWorkflowDefinitionInput,
  type WorkflowActionContext,
  type WorkflowActionHandler,
  type WorkflowActionRegistration,
  type WorkflowDefinition,
  type WorkflowDefinitionsStore,
  type WorkflowRun,
  type WorkflowRunStatus,
  type WorkflowStep,
  type WorkflowStepResult,
};

export { MIGRATIONS_TABLE_NAME, PLUGIN_ID, entities, migrations } from './database.js';

function ensureBuiltinActions(): void {
  if (getWorkflowAction('workflow.log')) {
    return;
  }
  /** Built-in log action — useful for smoke / gate wiring. */
  registerWorkflowAction('workflow.log', async (ctx) => {
    ctx.context.lastLog = {
      aggregateId: ctx.aggregateId,
      eventName: ctx.eventName,
      params: ctx.params,
    };
  });
}

/**
 * Workflow engine — multi-step automation triggered by domain events (Phase 8 B).
 * Definitions + runner live in this plugin; core provides event bus + jobs hooks.
 */
export default definePlugin({
  id: 'workflow',

  async install(_ctx) {
    // Optional: host applies plugin-owned TypeORM migrations (see ./database).
  },

  async boot(ctx) {
    ensureBuiltinActions();

    ctx.registerProvider({
      token: 'workflow.ready',
      provider: { ready: true, channel: 'workflow' },
    });

    ctx.registerProvider({
      token: 'workflow.engine',
      provider: {
        registerAction: registerWorkflowAction,
        listActions: listWorkflowActions,
        getAction: getWorkflowAction,
        upsertDefinition: upsertWorkflowDefinition,
        listDefinitions: listWorkflowDefinitions,
        run: runWorkflow,
        handleEvent: handleTriggerEvent,
        listRuns: listWorkflowRuns,
        bindDefinitionsStore: bindWorkflowDefinitionsStore,
      },
    });

    ctx.registerListener(
      ORDER_PAID_EVENT,
      async (event) => {
        const envelope = event as DomainEventLike;
        await handleTriggerEvent({
          eventName: envelope.eventName ?? ORDER_PAID_EVENT,
          aggregateId: envelope.aggregateId,
          data: envelope.data,
          eventId: envelope.eventId,
        });
      },
      { id: 'plugin-workflow.order-paid' },
    );

    ctx.registerGraphQL({
      name: 'workflowDefinitions',
      kind: 'query',
      descriptor: {
        resolve: async (): Promise<WorkflowDefinition[]> => listWorkflowDefinitions(),
      },
    });
    ctx.registerGraphQL({
      name: 'upsertWorkflowDefinition',
      kind: 'mutation',
      descriptor: {
        resolve: async (
          _parent: unknown,
          args: { input: UpsertWorkflowDefinitionInput },
        ): Promise<WorkflowDefinition> => upsertWorkflowDefinition(args.input),
      },
    });
    ctx.registerGraphQL({
      name: 'workflowRuns',
      kind: 'query',
      descriptor: {
        resolve: async (): Promise<WorkflowRun[]> => listWorkflowRuns(),
      },
    });

    ctx.registerAdmin({
      navigation: [
        {
          id: 'workflow-nav',
          label: 'Workflows',
          path: '/plugins/workflow',
          permission: 'plugin:workflow:read',
        },
      ],
      settings: [
        {
          id: 'workflow-settings',
          title: 'Workflow',
          path: '/plugins/workflow/settings',
          permission: 'plugin:workflow:configure',
        },
      ],
      permissions: ['plugin:workflow:read', 'plugin:workflow:configure', 'plugin:workflow:manage'],
    });
  },

  async enable(_ctx) {
    // Called when the plugin is enabled at runtime.
  },

  async disable(_ctx) {
    // Called when the plugin is disabled at runtime.
  },

  async uninstall(_ctx) {
    // Optional: cleanup (plugin-owned tables only).
  },
});
