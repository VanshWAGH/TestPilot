import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "./auth.guard";
import { CurrentUser } from "./current-user.decorator";
import { Public } from "./public.decorator";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  @Get("me")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current authenticated user and workspaces" })
  @ApiResponse({ status: 200, description: "Current user profile with workspaces" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getMe(@CurrentUser() user: any) {
    return {
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      workspaces: user.ownedWorkspaces,
      memberships: user.memberships,
    };
  }

  @Get("status")
  @Public()
  @ApiOperation({ summary: "Public authentication provider status" })
  @ApiResponse({ status: 200, description: "Auth provider configuration status" })
  async getStatus() {
    return {
      provider: "clerk",
      status: "ready",
      configured: Boolean(process.env.CLERK_SECRET_KEY),
    };
  }
}
