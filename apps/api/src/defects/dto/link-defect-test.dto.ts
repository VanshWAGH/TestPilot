import { IsString } from "class-validator";

export class LinkDefectTestDto {
  @IsString()
  defectId: string;

  @IsString()
  testResultId: string;
}
