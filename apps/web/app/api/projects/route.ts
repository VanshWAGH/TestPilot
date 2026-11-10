import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateProjectSchema } from "@testpilot/shared";

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api/v1";

// ---------------------------------------------------------------------------
// Shared helper: get auth token (no-throw)
// ---------------------------------------------------------------------------
async function getAuthToken(): Promise<string | null> {
  try {
    const session = await auth();
    const token = await session.getToken();
    if (token) return token;
  } catch {
    // Session token unavailable
  }
  if (process.env.NODE_ENV !== "production") {
    return "dev_token";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Standalone seed data (used when backend is unreachable)
// ---------------------------------------------------------------------------
const STANDALONE_PROJECTS = [
  {
    id: "proj-saucedemo-001",
    workspaceId: "ws-default-local",
    name: "SauceDemo E-Commerce QA",
    baseUrl: "https://www.saucedemo.com",
    defaultEnvironment: "staging",
    crawlDepth: 2,
    testTypes: ["smoke", "functional", "form_validation", "navigation"],
    githubTestRepo: "acme-qa/saucedemo-playwright-tests",
    githubDefectRepo: "acme-qa/saucedemo-defects",
    defectSystem: "github_issues",
    ciProvider: "github_actions",
    autoHealMode: "auto-safe",
    lastCrawlAt: null,
    lastRunAt: null,
    pageCount: 0,
    testCount: 4,
    healthScore: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _mode: "standalone_fallback",
  },
];

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE_URL}/projects`, { headers, cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    // Backend unreachable — return seed data
    return NextResponse.json(STANDALONE_PROJECTS);
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();

    // Validate using shared zod schema
    const validationResult = CreateProjectSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const payload = validationResult.data;

    // Retrieve clerk session token if signed in
    let token: string | null = null;
    try {
      const authSession = await auth();
      token = await authSession.getToken();
    } catch {
      // In dev or non-authenticated test mode, continue without token
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const apiResponse = await fetch(`${API_BASE_URL}/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const responseData = await apiResponse.json();

      if (!apiResponse.ok) {
        return NextResponse.json(responseData, {
          status: apiResponse.status,
        });
      }

      return NextResponse.json(responseData, { status: 201 });
    } catch (networkError: any) {
      console.warn(
        `Backend API at ${API_BASE_URL}/projects is unreachable (${networkError.message}). Operating in standalone mode.`
      );

      // Graceful fallback for standalone frontend development
      const mockProject = {
        id: `proj-${Date.now()}`,
        workspaceId: "ws-default-local",
        name: payload.name,
        baseUrl: payload.baseUrl,
        defaultEnvironment: payload.defaultEnvironment,
        crawlDepth: payload.crawlDepth,
        testTypes: payload.testTypes,
        githubTestRepo: payload.githubTestRepo,
        githubDefectRepo: payload.githubDefectRepo,
        defectSystem: payload.defectSystem,
        ciProvider: payload.ciProvider,
        autoHealMode: payload.autoHealMode,
        environments: [
          {
            id: `env-${Date.now()}`,
            name: payload.defaultEnvironment,
            baseUrl: payload.baseUrl,
            isDefault: true,
            hasCredentials: Boolean(
              payload.credentials?.username || payload.credentials?.password
            ),
            createdAt: new Date().toISOString(),
          },
        ],
        lastCrawlAt: null,
        lastRunAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _mode: "standalone_fallback",
      };

      return NextResponse.json(mockProject, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
