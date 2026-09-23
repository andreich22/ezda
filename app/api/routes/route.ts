import {NextResponse} from "next/server";
import {parseCreateRouteInput} from "../../../lib/route-validation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
    console.error("Route save failed", error);
    return NextResponse.json({error: "Unable to save route"}, {status: 500});
  }
}
