import { NextResponse } from "next/server";
import { setSetting } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const { domain } = body;

  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://${domain}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok || res.status < 500) {
      await setSetting("ssl_enabled", "true");
      return NextResponse.json({ working: true });
    }

    return NextResponse.json({
      working: false,
      error: `Server returned ${res.status}`,
    });
  } catch (error) {
    return NextResponse.json({
      working: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
