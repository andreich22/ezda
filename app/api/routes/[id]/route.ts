import {NextResponse} from "next/server";
import {getCurrentUser} from "../../../../lib/current-user";
import {isValidRouteId} from "../../../../lib/route-id";
import {parseCreateRouteInput} from "../../../../lib/route-validation";

const MAX_BODY_BYTES = 256 * 1024;

type Props = {
  params: Promise<{id: string}>;
};

async function requireRouteOwner(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return {response: NextResponse.json({error: "authentication required"}, {status: 401})};
  }

  if (!isValidRouteId(id)) {
    return {response: NextResponse.json({error: "route not found"}, {status: 404})};
  }

  const {getRouteOwnership} = await import("../../../../lib/db/routes");
  const route = await getRouteOwnership(id);

  if (!route) {
    return {response: NextResponse.json({error: "route not found"}, {status: 404})};
  }

  if (route.authorId !== user.id) {
    return {response: NextResponse.json({error: "route ownership required"}, {status: 403})};
  }

  return {user};
}

async function parseBody(req: Request) {
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return {error: "request body is too large", status: 413} as const;
  }

  try {
    const body = JSON.parse(rawBody) as unknown;
    const input = parseCreateRouteInput(body);
    if ("error" in input) return {error: input.error, status: 400} as const;
    return {input} as const;
  } catch {
    return {error: "invalid JSON body", status: 400} as const;
  }
}

export async function PATCH(req: Request, {params}: Props) {
  const {id} = await params;
  const owner = await requireRouteOwner(id);
  if ("response" in owner) return owner.response;

  const parsed = await parseBody(req);
  if ("error" in parsed) {
    return NextResponse.json({error: parsed.error}, {status: parsed.status});
  }

  try {
    const {updateRoute} = await import("../../../../lib/db/routes");
    const route = await updateRoute(id, owner.user.id, parsed.input);

    if (!route) {
      return NextResponse.json({error: "route not found"}, {status: 404});
    }

    return NextResponse.json({id: route.id, url: `/routes/${route.id}`});
  } catch (error) {
    console.error("Route update failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({error: "Unable to update route"}, {status: 500});
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
      return NextResponse.json({error: "route not found"}, {status: 404});
    }

    return new Response(null, {status: 204});
  } catch (error) {
    console.error("Route delete failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({error: "Unable to delete route"}, {status: 500});
  }
}
