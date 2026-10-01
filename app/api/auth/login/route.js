import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "../../../../lib/supabase";
import { createSession } from "../../../../lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم المستخدم وكلمة المرور مطلوبان.",
        },
        { status: 400 }
      );
    }

    const { data: account, error } = await supabase
      .from("accounts")
      .select(`
        id,
        username,
        password_hash,
        role,
        is_active,
        person:people (
          id,
          family_id,
          first_name,
          middle_name,
          last_name
        )
      `)
      .ilike("username", username)
      .maybeSingle();

    if (error) {
      console.error("Login account lookup error:", error);

      return NextResponse.json(
        {
          success: false,
          message: "حدث خطأ أثناء تسجيل الدخول.",
        },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم المستخدم أو كلمة المرور غير صحيحة.",
        },
        { status: 401 }
      );
    }

    if (!account.is_active) {
      return NextResponse.json(
        {
          success: false,
          message: "هذا الحساب غير مفعل.",
        },
        { status: 403 }
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      account.password_hash
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم المستخدم أو كلمة المرور غير صحيحة.",
        },
        { status: 401 }
      );
    }

    await createSession(account.id);

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        username: account.username,
        role: account.role,
        person: account.person,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع.",
      },
      { status: 500 }
    );
  }
}
