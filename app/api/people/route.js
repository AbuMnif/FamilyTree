import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "../../../lib/supabase";
import { getCurrentAccount } from "../../../lib/auth";

export async function GET() {
  try {
    const account = await getCurrentAccount();

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "غير مصرح.",
        },
        { status: 401 }
      );
    }

    let query = supabase
      .from("people")
      .select(`
        id,
        family_id,
        first_name,
        middle_name,
        last_name,
        gender,
        birth_date,
        death_date,
        birth_place,
        death_place,
        bio,
        photo_url,
        created_at,
        account:accounts (
          id,
          username,
          role,
          is_active
        )
      `)
      .order("first_name", {
        ascending: true,
      });

    /*
      المحرر يستطيع مشاهدة جميع العائلات.
      المستخدم العادي يرى عائلته فقط.
    */
    if (account.role !== "editor") {
      const familyId = account?.person?.family_id;

      if (!familyId) {
        return NextResponse.json(
          {
            success: false,
            message: "تعذر تحديد العائلة المرتبطة بالحساب.",
          },
          { status: 400 }
        );
      }

      query = query.eq("family_id", familyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("People GET error:", error);

      return NextResponse.json(
        {
          success: false,
          message: "تعذر تحميل الأشخاص.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      people: data || [],
    });
  } catch (error) {
    console.error("People GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const account = await getCurrentAccount();

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "غير مصرح.",
        },
        { status: 401 }
      );
    }

    /*
      إنشاء الحسابات للمحرر فقط.
    */
    if (account.role !== "editor") {
      return NextResponse.json(
        {
          success: false,
          message: "ليس لديك صلاحية إنشاء الحسابات.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const personId = String(body.personId || "").trim();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(
      body.confirmPassword || ""
    );

    if (!personId) {
      return NextResponse.json(
        {
          success: false,
          message: "الشخص المطلوب غير محدد.",
        },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم المستخدم مطلوب.",
        },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل.",
        },
        { status: 400 }
      );
    }

    if (username.length > 50) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم المستخدم طويل جدًا.",
        },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام و . _ - فقط.",
        },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          message: "كلمة المرور مطلوبة.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "كلمتا المرور غير متطابقتين.",
        },
        { status: 400 }
      );
    }

    /*
      التأكد من وجود الشخص.
    */
    const { data: person, error: personError } = await supabase
      .from("people")
      .select(`
        id,
        family_id,
        first_name,
        middle_name,
        last_name
      `)
      .eq("id", personId)
      .maybeSingle();

    if (personError) {
      console.error(
        "Person lookup error:",
        personError
      );

      return NextResponse.json(
        {
          success: false,
          message: "تعذر التحقق من الشخص.",
        },
        { status: 500 }
      );
    }

    if (!person) {
      return NextResponse.json(
        {
          success: false,
          message: "الشخص غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
      التأكد من عدم وجود حساب للشخص مسبقًا.
    */
    const {
      data: existingPersonAccount,
      error: existingPersonAccountError,
    } = await supabase
      .from("accounts")
      .select("id, username")
      .eq("person_id", personId)
      .maybeSingle();

    if (existingPersonAccountError) {
      console.error(
        "Existing person account lookup error:",
        existingPersonAccountError
      );

      return NextResponse.json(
        {
          success: false,
          message: "تعذر التحقق من حساب الشخص.",
        },
        { status: 500 }
      );
    }

    if (existingPersonAccount) {
      return NextResponse.json(
        {
          success: false,
          message:
            "هذا الشخص لديه حساب بالفعل.",
        },
        { status: 409 }
      );
    }

    /*
      التأكد من أن اسم المستخدم غير مستخدم.
      نستخدم ilike حتى لا يصبح:
      Ahmed
      ahmed

      حسابين مختلفين منطقيًا.
    */
    const {
      data: existingUsername,
      error: existingUsernameError,
    } = await supabase
      .from("accounts")
      .select("id, username")
      .ilike("username", username)
      .maybeSingle();

    if (existingUsernameError) {
      console.error(
        "Username lookup error:",
        existingUsernameError
      );

      return NextResponse.json(
        {
          success: false,
          message: "تعذر التحقق من اسم المستخدم.",
        },
        { status: 500 }
      );
    }

    if (existingUsername) {
      return NextResponse.json(
        {
          success: false,
          message:
            "اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const { data: createdAccount, error: createError } =
      await supabase
        .from("accounts")
        .insert({
          username,
          password_hash: passwordHash,
          person_id: personId,
          role: "user",
          is_active: true,
        })
        .select(`
          id,
          username,
          role,
          is_active,
          person:people (
            id,
            first_name,
            middle_name,
            last_name
          )
        `)
        .single();

    if (createError) {
      console.error(
        "Create account error:",
        createError
      );

      return NextResponse.json(
        {
          success: false,
          message: "تعذر إنشاء الحساب.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم إنشاء الحساب بنجاح.",
      account: createdAccount,
    });
  } catch (error) {
    console.error("People POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع.",
      },
      { status: 500 }
    );
  }
}
