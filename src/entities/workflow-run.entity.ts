import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { WorkflowRunStatus, WorkflowStepResult } from '../runner.js';

/** OWNER: @opoha/plugin-workflow — workflow run observability row (ADR-0005). */
@Entity({ name: 'plugin_workflow_runs' })
export class WorkflowRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workflow_code', type: 'text' })
  workflowCode!: string;

  @Column({ name: 'trigger_event', type: 'text' })
  triggerEvent!: string;

  @Column({ name: 'aggregate_id', type: 'text' })
  aggregateId!: string;

  @Column({ type: 'text' })
  status!: WorkflowRunStatus;

  @Column({ name: 'step_results', type: 'jsonb' })
  stepResults!: WorkflowStepResult[];

  @Column({ type: 'jsonb', default: {} })
  context!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
