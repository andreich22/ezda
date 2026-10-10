import {NextResponse} from "next/server";
import {parseCreateRouteInput} from "../../../lib/route-validation";
import {getCurrentUser} from "../../../lib/current-user";
import {normalizeRouteVisibility} from "../../../lib/route-filters";
import {normalizeRoutePagination} from "../../../lib/route-pagination";
import {
  API_ERROR_CODES,
  errorResponse,
  logServerError,
} from "../../../lib/api-errors";

const MAX_BODY_BYTES = 256 * 1024;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const url = new URL(req.url);
    const {page, pageSize} = normalizeRoutePagination(
      url.searchParams.get("page"),
      url.searchParams.get("limit"),
    );
    const visibility = normalizeRouteVisibility(
      url.searchParams.get("visibility") ?? undefined,
      Boolean(user),
    );

    const {getPublicRoutes} = await import("../../../lib/db/routes");
    const catalog = await getPublicRoutes(page, pageSize, visibility, user?.id);

    return NextResponse.json(catalog, {
      headers: {"Cache-Control": "private, no-store"},
    });
  } catch (error) {
    logServerError(
      "routes-catalog",
      error instanceof Error ? error.message : "unknown error",
    );
    return errorResponse(API_ERROR_CODES.LOAD_FAILED, "Unable to load routes", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse(API_ERROR_CODES.AUTH_REQUIRED, "authentication required", 401);
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return errorResponse(API_ERROR_CODES.BODY_TOO_LARGE, "request body is too large", 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse(API_ERROR_CODES.INVALID_JSON, "invalid JSON body", 400);
    }

    const input = parseCreateRouteInput(body);
    if ("error" in input) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, input.error, 400);
    }

    const {createRoute} = await import("../../../lib/db/routes");
    const route = await createRoute(input, user.id);

    return NextResponse.json(
      {id: route.id, url: `/routes/${route.id}`},
      {status: 201},
    );
  } catch (error) {
    logServerError("routes-save", error instanceof Error ? error.message : "unknown error");
    return errorResponse(API_ERROR_CODES.SAVE_FAILED, "Unable to save route", 500);
  }
}
