import {NextResponse} from "next/server";
import {sendPasswordReset} from "../../../../lib/auth";\nimport {getPasswordRecoveryRedirect} from "../../../../lib/auth-redirect";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json({error: "Email is required"}, {status: 400});
    }

    const origin = new URL(request.url).origin;
    await sendPasswordReset(email, `${origin}/auth`);
    return NextResponse.json({ok: true});
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : "Unable to send reset email"},
      {status: 400},
    );
  }
}
