import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ClerkService } from "./clerk.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clerkService: ClerkService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }

    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer" || !token) {
      throw new UnauthorizedException(
        "Invalid Authorization header format. Expected 'Bearer <token>'",
      );
    }

    try {
      const payload = await this.clerkService.verifyToken(token);
      if (!payload || !payload.sub) {
        throw new UnauthorizedException("Invalid token payload: missing sub claim");
      }

      // Sync or retrieve user from database
      const dbUser = await this.clerkService.syncUserWithDatabase(payload.sub);

      // Attach auth info and dbUser to request
      request.auth = payload;
      request.user = dbUser;

      return true;
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : "Authentication failed",
      );
    }
  }
}
