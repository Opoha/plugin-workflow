import { WorkflowDefinitionEntity } from './workflow-definition.entity.js';
import { WorkflowRunEntity } from './workflow-run.entity.js';

/** TypeORM entities owned by this plugin (ADR-0005). */
export const workflowEntities = [
  WorkflowDefinitionEntity,
  WorkflowRunEntity,
] as const;

export { WorkflowDefinitionEntity, WorkflowRunEntity };
