import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "../../../lib/supabase";

export async function POST(request) {
  try {
    /*
    =========================================================
    1. التأكد أن النظام ما زال في مرحلة الإعداد الأولي
    =========================================================
    */

    const { count, error: countError } = await supabase
      .from("accounts")
      .select("id", {
        count: "exact",
        head: true,
      });

    if (countError) {
      console.error("Setup account count error:", countError);

      return NextResponse.json(
        {
          success: false,
          message: "تعذر التحقق من حالة النظام.",
        },
        { status: 500 }
      );
    }

    if (count > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "تم إعداد النظام مسبقًا.",
        },
        { status: 403 }
      );
    }

    /*
    =========================================================
    2. قراءة البيانات
    =========================================================
    */

    const body = await request.json();

    const familyName = String(body.familyName || "").trim();
    const firstName = String(body.firstName || "").trim();
    const middleName = String(body.middleName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const gender = String(body.gender || "");
    const birthDate = body.birthDate || null;
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!familyName || !firstName || !username || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "تأكد من تعبئة جميع الحقول المطلوبة.",
        },
        { status: 400 }
      );
    }

    if (!["male", "female"].includes(gender)) {
      return NextResponse.json(
        {
          success: false,
          message: "نوع الجنس غير صحيح.",
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

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
        },
        { status: 400 }
      );
    }

    /*
    =========================================================
    3. تشفير كلمة المرور
    =========================================================
    */

    const passwordHash = await bcrypt.hash(password, 12);

    /*
    =========================================================
    4. إنشاء العائلة
    =========================================================
    */

    const { data: family, error: familyError } = await supabase
      .from("families")
      .insert({
        name: familyName,
      })
      .select("id, name")
      .single();

    if (familyError) {
      console.error("Create family error:", familyError);

      return NextResponse.json(
        {
          success: false,
          message: "تعذر إنشاء العائلة.",
        },
        { status: 500 }
      );
    }

    /*
    =========================================================
    5. إنشاء الشخص
    =========================================================
    */

    const { data: person, error: personError } = await supabase
      .from("people")
      .insert({
        family_id: family.id,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName || null,
        gender,
        birth_date: birthDate,
      })
      .select(`
        id,
        family_id,
        first_name,
        middle_name,
        last_name
      `)
      .single();

    if (personError) {
      console.error("Create person error:", personError);

      await supabase
        .from("families")
        .delete()
        .eq("id", family.id);

      return NextResponse.json(
        {
          success: false,
          message: "تعذر إنشاء الشخص.",
        },
        { status: 500 }
      );
    }

    /*
    =========================================================
    6. إنشاء حساب المحرر
    =========================================================
    */

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .insert({
        username,
        password_hash: passwordHash,
        person_id: person.id,
        role: "editor",
        is_active: true,
      })
      .select(`
        id,
        username,
        role,
        person_id
      `)
      .single();

    if (accountError) {
      console.error("Create account error:", accountError);

      await supabase
        .from("people")
        .delete()
        .eq("id", person.id);

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر إنشاء الحساب. قد يكون اسم المستخدم مستخدمًا بالفعل.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم إنشاء النظام والحساب بنجاح.",
      account,
      person,
      family,
    });
  } catch (error) {
    console.error("Setup error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع أثناء إعداد النظام.",
      },
      { status: 500 }
    );
  }
}
