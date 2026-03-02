import { NextResponse } from "next/server";

export async function GET(req) {
  const domain = req.headers.get("x-client-domain");
  if (!domain) {
    return NextResponse.json({
      success: false,
      error: "Missing domain header",
    });
  }

  try {
    console.log("Requested domain:", domain);
    const res = await fetch(
      `https://${domain}/wp-json/chatbot/v1/settings-frontend`
    );

    const data = await res.json();

    if (data.success) {
      return NextResponse.json(data);
    }
    return NextResponse.json({
      success: false,
      data: [],
      message: "No data found.",
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
