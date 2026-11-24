import { IsString, IsOptional, IsIn } from "class-validator";

export class CreateDefectDto {
  @IsString()
  testResultId: string;

  @IsString()
  testRunId: string;

  @IsOptional()
  @IsIn(["github_issues", "jira"])
  externalSystem?: "github_issues" | "jira";
}
