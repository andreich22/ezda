import {NextResponse} from "next/server";
import {parseCreateRouteInput} from "../../../lib/route-validation";

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(req: Request) {
  try {
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
    const route = await createRoute(input);

    return NextResponse.json(
      {id: route.id, url: `/routes/${route.id}`},
      {status: 201},
    );
  } catch (error) {
    console.error("Route save failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({error: "Unable to save route"}, {status: 500});
  }
}
