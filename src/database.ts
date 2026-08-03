import 'reflect-metadata';

/**
 * Plugin-owned TypeORM surface for CLI / host migration aggregation.
 */

import { WorkflowDefinitionEntity } from './entities/workflow-definition.entity.js';
import { WorkflowRunEntity } from './entities/workflow-run.entity.js';
import { workflowEntities } from './entities/index.js';
import { WorkflowInit1754300400000 } from './migrations/1754300400000-WorkflowInit.js';
import { workflowMigrations } from './migrations/index.js';

export const PLUGIN_ID = 'workflow' as const;

/** Namespaced migrations table — never shares core `migrations`. */
export const MIGRATIONS_TABLE_NAME = 'opoha_migrations_workflow' as const;

export const entities = workflowEntities;
export const migrations = workflowMigrations;

export {
  WorkflowDefinitionEntity,
  WorkflowRunEntity,
  WorkflowInit1754300400000,
  workflowEntities,
  workflowMigrations,
};
