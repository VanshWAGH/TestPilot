-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "github_test_repo" DROP NOT NULL,
ALTER COLUMN "github_defect_repo" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "crawl_jobs_project_id_idx" ON "crawl_jobs"("project_id");

-- CreateIndex
CREATE INDEX "crawl_jobs_project_id_status_idx" ON "crawl_jobs"("project_id", "status");

-- CreateIndex
CREATE INDEX "crawl_jobs_environment_id_idx" ON "crawl_jobs"("environment_id");

-- CreateIndex
CREATE INDEX "defects_project_id_idx" ON "defects"("project_id");

-- CreateIndex
CREATE INDEX "defects_project_id_status_idx" ON "defects"("project_id", "status");

-- CreateIndex
CREATE INDEX "defects_external_system_external_id_idx" ON "defects"("external_system", "external_id");

-- CreateIndex
CREATE INDEX "environments_project_id_idx" ON "environments"("project_id");

-- CreateIndex
CREATE INDEX "healing_proposals_project_id_idx" ON "healing_proposals"("project_id");

-- CreateIndex
CREATE INDEX "healing_proposals_project_id_status_idx" ON "healing_proposals"("project_id", "status");

-- CreateIndex
CREATE INDEX "healing_proposals_test_result_id_idx" ON "healing_proposals"("test_result_id");

-- CreateIndex
CREATE INDEX "healing_proposals_element_id_idx" ON "healing_proposals"("element_id");

-- CreateIndex
CREATE INDEX "page_elements_page_id_idx" ON "page_elements"("page_id");

-- CreateIndex
CREATE INDEX "page_elements_dom_fingerprint_idx" ON "page_elements"("dom_fingerprint");

-- CreateIndex
CREATE INDEX "page_snapshots_page_id_idx" ON "page_snapshots"("page_id");

-- CreateIndex
CREATE INDEX "page_snapshots_crawl_job_id_idx" ON "page_snapshots"("crawl_job_id");

-- CreateIndex
CREATE INDEX "pages_project_id_idx" ON "pages"("project_id");

-- CreateIndex
CREATE INDEX "pages_project_id_url_idx" ON "pages"("project_id", "url");

-- CreateIndex
CREATE INDEX "pages_crawl_job_id_idx" ON "pages"("crawl_job_id");

-- CreateIndex
CREATE INDEX "projects_workspace_id_idx" ON "projects"("workspace_id");

-- CreateIndex
CREATE INDEX "scenarios_project_id_idx" ON "scenarios"("project_id");

-- CreateIndex
CREATE INDEX "scenarios_project_id_status_idx" ON "scenarios"("project_id", "status");

-- CreateIndex
CREATE INDEX "scenarios_page_id_idx" ON "scenarios"("page_id");

-- CreateIndex
CREATE INDEX "test_files_scenario_id_idx" ON "test_files"("scenario_id");

-- CreateIndex
CREATE INDEX "test_results_test_run_id_idx" ON "test_results"("test_run_id");

-- CreateIndex
CREATE INDEX "test_results_test_run_id_status_idx" ON "test_results"("test_run_id", "status");

-- CreateIndex
CREATE INDEX "test_results_scenario_id_idx" ON "test_results"("scenario_id");

-- CreateIndex
CREATE INDEX "test_runs_project_id_idx" ON "test_runs"("project_id");

-- CreateIndex
CREATE INDEX "test_runs_project_id_status_idx" ON "test_runs"("project_id", "status");

-- CreateIndex
CREATE INDEX "test_runs_project_id_created_at_idx" ON "test_runs"("project_id", "created_at" DESC);
