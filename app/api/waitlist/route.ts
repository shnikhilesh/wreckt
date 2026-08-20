import { NextRequest, NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let email: unknown;

  try {
    const body = await request.json();
    email = body?.email;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 },
    );
  }

  const apiKey = process.env.BUTTONDOWN_API_KEY;

  if (!apiKey) {
    console.error("BUTTONDOWN_API_KEY is not set");
    return NextResponse.json(
      { error: "Waitlist is temporarily unavailable — try again later" },
      { status: 500 },
    );
  }

  try {
    const subscribe = (tagged: boolean) =>
      fetch("https://api.buttondown.email/v1/subscribers", {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        // Buttondown renamed `email` to `email_address` in a later API
        // version — the old field name is silently rejected (422).
        body: JSON.stringify(
          tagged
            ? { email_address: email, tags: ["waitlist"] }
            : { email_address: email },
        ),
      });

    let response = await subscribe(true);
    let errorBody = response.ok ? null : await response.json().catch(() => null);

    // Tags require a paid Buttondown plan. Don't let a free-plan account
    // block signups over a cosmetic label — retry once without tags.
    if (response.status === 403 && errorBody?.code === "feature_disabled") {
      response = await subscribe(false);
      errorBody = response.ok ? null : await response.json().catch(() => null);
    }

    if (response.ok) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (response.status === 409) {
      return NextResponse.json(
        { error: "You're already on the list" },
        { status: 409 },
      );
    }

    console.error("Buttondown error:", response.status, errorBody);
    return NextResponse.json(
      { error: "Couldn't join the waitlist — try again" },
      { status: 502 },
    );
  } catch (error) {
    console.error("Failed to reach Buttondown:", error);
    return NextResponse.json(
      { error: "Couldn't join the waitlist — try again" },
      { status: 502 },
    );
  }
}
