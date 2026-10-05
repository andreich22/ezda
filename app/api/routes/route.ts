import {NextResponse} from "next/server";
import {parseCreateRouteInput} from "../../../lib/route-validation";
import {getCurrentUser} from "../../../lib/current-user";
import {normalizeRouteVisibility} from "../../../lib/route-filters";
import {normalizeRoutePagination} from "../../../lib/route-pagination";

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
    console.error("Route catalog lookup failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({error: "Unable to load routes"}, {status: 500});
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({error: "authentication required"}, {status: 401});
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({error: "request body is too large"}, {status: 413});
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({error: "invalid JSON body"}, {status: 400});
    }

    const input = parseCreateRouteInput(body);
    if ("error" in input) {
      return NextResponse.json({error: input.error}, {status: 400});
    }

    const {createRoute} = await import("../../../lib/db/routes");
    const route = await createRoute(input, user.id);

    return NextResponse.json(
      {id: route.id, url: `/routes/${route.id}`},
      {status: 201},
    );
  } catch (error) {
    console.error("Route save failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({error: "Unable to save route"}, {status: 500});
  }
}
