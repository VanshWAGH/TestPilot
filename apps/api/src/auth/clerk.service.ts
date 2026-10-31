import { Injectable, Logger } from "@nestjs/common";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ClerkService {
  private readonly logger = new Logger(ClerkService.name);
  private clerkClient: ReturnType<typeof createClerkClient> | null = null;
  private readonly secretKey = process.env.CLERK_SECRET_KEY;
  private readonly publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  constructor(private readonly prisma: PrismaService) {
    if (this.secretKey) {
      this.clerkClient = createClerkClient({
        secretKey: this.secretKey,
        publishableKey: this.publishableKey,
      });
      this.logger.log("Clerk client successfully initialized");
    } else {
      this.logger.warn("CLERK_SECRET_KEY is not set. Clerk client disabled.");
    }
  }

  async verifyToken(token: string) {
    if (!this.secretKey) {
      throw new Error("CLERK_SECRET_KEY is not configured on the server");
    }
    return verifyToken(token, {
      secretKey: this.secretKey,
    });
  }

  async getClerkUser(userId: string) {
    if (!this.clerkClient) {
      throw new Error("Clerk client is not initialized");
    }
    return this.clerkClient.users.getUser(userId);
  }

  async syncUserWithDatabase(clerkUserId: string) {
    // Check if user already exists in DB
    let user = await this.prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: {
        ownedWorkspaces: true,
        memberships: {
          include: { workspace: true },
        },
      },
    });

    if (user) {
      return user;
    }

    // If not in database, attempt to fetch user from Clerk API
    try {
      const clerkUser = await this.getClerkUser(clerkUserId);
      const primaryEmail =
        clerkUser.emailAddresses?.find(
          (e: { id: string; emailAddress: string }) => e.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress ||
        clerkUser.emailAddresses?.[0]?.emailAddress ||
        `${clerkUserId}@user.testpilot.dev`;

      const fullName =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        primaryEmail.split("@")[0] ||
        "TestPilot User";

      const defaultSlug = `workspace-${clerkUserId.slice(-6).toLowerCase()}`;

      user = await this.prisma.user.create({
        data: {
          clerkId: clerkUserId,
          email: primaryEmail,
          name: fullName,
          avatarUrl: clerkUser.imageUrl,
          ownedWorkspaces: {
            create: {
              name: `${fullName}'s Workspace`,
              slug: defaultSlug,
            },
          },
        },
        include: {
          ownedWorkspaces: true,
          memberships: {
            include: { workspace: true },
          },
        },
      });

      if (user.ownedWorkspaces.length > 0) {
        await this.prisma.workspaceMember.create({
          data: {
            workspaceId: user.ownedWorkspaces[0].id,
            userId: user.id,
            role: "owner",
          },
        });
      }

      return user;
    } catch (err) {
      this.logger.error(`Error syncing user from Clerk: ${(err as Error).message}`);
      // Fallback: create a basic user record if Clerk API fetch fails
      const fallbackEmail = `${clerkUserId}@user.testpilot.dev`;
      const fallbackSlug = `ws-${clerkUserId.slice(-6).toLowerCase()}`;
      return this.prisma.user.create({
        data: {
          clerkId: clerkUserId,
          email: fallbackEmail,
          name: "TestPilot User",
          ownedWorkspaces: {
            create: {
              name: "Default Workspace",
              slug: fallbackSlug,
            },
          },
        },
        include: {
          ownedWorkspaces: true,
          memberships: {
            include: { workspace: true },
          },
        },
      });
    }
  }
}
