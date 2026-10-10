import {NextResponse} from "next/server";
import {getCurrentUser} from "../../../../lib/current-user";
import {isValidRouteId} from "../../../../lib/route-id";
import {parseCreateRouteInput, type CreateRouteInput} from "../../../../lib/route-validation";
import {
  API_ERROR_CODES,
  type ApiErrorCode,
  errorResponse,
  logServerError,
} from "../../../../lib/api-errors";

const MAX_BODY_BYTES = 256 * 1024;

type Props = {
  params: Promise<{id: string}>;
};

async function requireRouteOwner(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return {response: errorResponse(API_ERROR_CODES.AUTH_REQUIRED, "authentication required", 401)};
  }

  if (!isValidRouteId(id)) {
    return {response: errorResponse(API_ERROR_CODES.NOT_FOUND, "route not found", 404)};
  }

  const {getRouteOwnership} = await import("../../../../lib/db/routes");
  const route = await getRouteOwnership(id);

  if (!route) {
    return {response: errorResponse(API_ERROR_CODES.NOT_FOUND, "route not found", 404)};
  }

  if (route.authorId !== user.id) {
    return {response: errorResponse(API_ERROR_CODES.FORBIDDEN, "route ownership required", 403)};
  }

  return {user};
}

type ParsedBody =
  | {input: CreateRouteInput}
  | {error: string; code: ApiErrorCode; status: number};

async function parseBody(req: Request): Promise<ParsedBody> {
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return {error: "request body is too large", code: API_ERROR_CODES.BODY_TOO_LARGE, status: 413};
  }

  try {
    const body = JSON.parse(rawBody) as unknown;
    const input = parseCreateRouteInput(body);
    if ("error" in input)
      return {error: input.error, code: API_ERROR_CODES.VALIDATION_ERROR, status: 400};
    return {input};
  } catch {
    return {error: "invalid JSON body", code: API_ERROR_CODES.INVALID_JSON, status: 400};
  }
}

export async function PATCH(req: Request, {params}: Props) {
  const {id} = await params;
  const owner = await requireRouteOwner(id);
  if ("response" in owner) return owner.response;

  const parsed = await parseBody(req);
  if ("error" in parsed) {
    return errorResponse(parsed.code, parsed.error, parsed.status);
  }

  try {
    const {updateRoute} = await import("../../../../lib/db/routes");
    const route = await updateRoute(id, owner.user.id, parsed.input);

    if (!route) {
      return errorResponse(API_ERROR_CODES.NOT_FOUND, "route not found", 404);
    }

    return NextResponse.json({id: route.id, url: `/routes/${route.id}`});
  } catch (error) {
    logServerError("routes-update", error instanceof Error ? error.message : "unknown error");
    return errorResponse(API_ERROR_CODES.UPDATE_FAILED, "Unable to update route", 500);
  }
}

export async function DELETE(_req: Request, {params}: Props) {
  const {id} = await params;
  const owner = await requireRouteOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const {deleteRoute} = await import("../../../../lib/db/routes");
    const route = await deleteRoute(id, owner.user.id);

    if (!route) {
      return errorResponse(API_ERROR_CODES.NOT_FOUND, "route not found", 404);
    }

    return new Response(null, {status: 204});
  } catch (error) {
    logServerError("routes-delete", error instanceof Error ? error.message : "unknown error");
    return errorResponse(API_ERROR_CODES.DELETE_FAILED, "Unable to delete route", 500);
  }
}
