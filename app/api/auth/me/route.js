import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";

export async function GET() {
  try {
    const account = await getCurrentAccount();

    if (!account) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      account,
    });
  } catch (error) {
    console.error("Auth me error:", error);

    return NextResponse.json(
      {
        authenticated: false,
      },
      { status: 500 }
    );
  }
}
