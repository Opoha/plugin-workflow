import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial workflow definition + run tables (ADR-0005).
 * Table prefix: plugin id `workflow` → `plugin_workflow_*`.
 */
export class WorkflowInit1754300400000 implements MigrationInterface {
  name = 'WorkflowInit1754300400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plugin_workflow_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "trigger_event" text NOT NULL,
        "steps" jsonb NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "plugin_workflow_definitions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "plugin_workflow_definitions_code_key" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "plugin_workflow_definitions_trigger_active_idx"
        ON "plugin_workflow_definitions" ("trigger_event", "is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE "plugin_workflow_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workflow_code" text NOT NULL,
        "trigger_event" text NOT NULL,
        "aggregate_id" text NOT NULL,
        "status" text NOT NULL,
        "step_results" jsonb NOT NULL,
        "context" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "error" text,
        "started_at" TIMESTAMPTZ NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "plugin_workflow_runs_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "plugin_workflow_runs_status_check"
          CHECK ("status" IN ('completed', 'failed', 'waiting_delay', 'waiting_approval'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "plugin_workflow_runs_workflow_started_idx"
        ON "plugin_workflow_runs" ("workflow_code", "started_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plugin_workflow_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plugin_workflow_definitions"`);
  }
}
