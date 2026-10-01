import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "../../../lib/supabase";
import { getCurrentAccount } from "../../../lib/auth";

/*
=========================================================
HELPERS
=========================================================
*/

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function splitNameParts(value) {
  return normalizeName(value)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildFullName(person) {
  if (Array.isArray(person?.name_parts) && person.name_parts.length) {
    return person.name_parts.join(" ");
  }

  return [
    person?.first_name,
    person?.middle_name,
    person?.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildLegacyFields(nameParts) {
  return {
    first_name: nameParts[0] || "",
    middle_name:
      nameParts.length > 2
        ? nameParts.slice(1, -1).join(" ")
        : nameParts[1] || null,
    last_name:
      nameParts.length > 2
        ? nameParts[nameParts.length - 1]
        : null,
  };
}

/*
=========================================================
GET PEOPLE
=========================================================
*/

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
        name_parts,
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

/*
=========================================================
POST
=========================================================

يدعم عمليتين:

1. إنشاء حساب لشخص موجود
   body.action = "create-account"

2. إضافة شخص بالاسم الكامل وبناء سلسلة الآباء
   body.action = "create-person"
=========================================================
*/

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

    if (account.role !== "editor") {
      return NextResponse.json(
        {
          success: false,
          message: "ليس لديك صلاحية تنفيذ هذا الإجراء.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const action = String(
      body.action || "create-account"
    ).trim();

    /*
    =====================================================
    إنشاء شخص بالاسم الكامل
    =====================================================
    */

    if (action === "create-person") {
      const familyId = String(
        body.familyId || account?.person?.family_id || ""
      ).trim();

      const fullName = normalizeName(body.fullName);

      const gender = body.gender === "female"
        ? "female"
        : "male";

      if (!familyId) {
        return NextResponse.json(
          {
            success: false,
            message: "تعذر تحديد العائلة.",
          },
          { status: 400 }
        );
      }

      if (!fullName) {
        return NextResponse.json(
          {
            success: false,
            message: "اكتب اسم الشخص كاملًا.",
          },
          { status: 400 }
        );
      }

      const nameParts = splitNameParts(fullName);

      if (nameParts.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "اسم الشخص غير صالح.",
          },
          { status: 400 }
        );
      }

      /*
        نمنع إنشاء شخص جديد إذا كان الاسم الكامل
        موجودًا مسبقًا بشكل مطابق.
      */
      const { data: existingPeople, error: existingPeopleError } =
        await supabase
          .from("people")
          .select(`
            id,
            family_id,
            first_name,
            middle_name,
            last_name,
            name_parts,
            gender,
            birth_date,
            death_date,
            birth_place,
            death_place,
            bio,
            photo_url
          `)
          .eq("family_id", familyId);

      if (existingPeopleError) {
        console.error(
          "Existing people lookup error:",
          existingPeopleError
        );

        return NextResponse.json(
          {
            success: false,
            message: "تعذر البحث في أفراد العائلة.",
          },
          { status: 500 }
        );
      }

      const normalizedFullName = fullName.toLocaleLowerCase("ar");

      const exactExistingPerson = (existingPeople || []).find(
        (item) =>
          buildFullName(item)
            .trim()
            .replace(/\s+/g, " ")
            .toLocaleLowerCase("ar") === normalizedFullName
      );

      if (exactExistingPerson) {
        return NextResponse.json(
          {
            success: false,
            code: "PERSON_EXISTS",
            message: "هذا الشخص موجود بالفعل في العائلة.",
            person: exactExistingPerson,
          },
          { status: 409 }
        );
      }

      /*
      =====================================================
      الشخص الأساسي
      =====================================================
      */

      const mainFields = buildLegacyFields(nameParts);

      const { data: createdPerson, error: createPersonError } =
        await supabase
          .from("people")
          .insert({
            family_id: familyId,
            ...mainFields,
            name_parts: nameParts,
            gender,
          })
          .select(`
            id,
            family_id,
            first_name,
            middle_name,
            last_name,
            name_parts,
            gender,
            birth_date,
            death_date,
            birth_place,
            death_place,
            bio,
            photo_url
          `)
          .single();

      if (createPersonError) {
        console.error(
          "Create person error:",
          createPersonError
        );

        return NextResponse.json(
          {
            success: false,
            message: "تعذر إضافة الشخص.",
          },
          { status: 500 }
        );
      }

      /*
      =====================================================
      بناء سلسلة الآباء
      =====================================================

      مثال:

      محمد
      حلمي
      محمد
      حسين
      عبدالله
      العريفي

      محمد = الشخص الجديد
      حلمي = أبوه
      محمد = جده
      حسين = جد الجد
      ...
      */

      let childPerson = createdPerson;

      const createdAncestors = [];
      const reusedAncestors = [];

      for (let index = 1; index < nameParts.length; index++) {
        const ancestorName = nameParts[index];

        /*
          نبحث عن شخص يحمل هذا الاسم وحده في نفس العائلة.

          إذا وجد شخص واحد فقط:
          نستخدمه.

          إذا وجد أكثر من شخص:
          لا نخمن، وننشئ شخصًا جديدًا.
        */
        const exactNameMatches = (existingPeople || []).filter(
          (item) => {
            const itemNameParts =
              Array.isArray(item.name_parts) &&
              item.name_parts.length
                ? item.name_parts
                : [
                    item.first_name,
                    item.middle_name,
                    item.last_name,
                  ].filter(Boolean);

            return (
              itemNameParts.length === 1 &&
              normalizeName(itemNameParts[0])
                .toLocaleLowerCase("ar") ===
                ancestorName
                  .toLocaleLowerCase("ar")
            );
          }
        );

        let ancestor = null;

        if (exactNameMatches.length === 1) {
          ancestor = exactNameMatches[0];

          reusedAncestors.push({
            id: ancestor.id,
            name: buildFullName(ancestor),
          });
        } else {
          const ancestorFields = buildLegacyFields([
            ancestorName,
          ]);

          const { data: createdAncestor, error: ancestorError } =
            await supabase
              .from("people")
              .insert({
                family_id: familyId,
                ...ancestorFields,
                name_parts: [ancestorName],
                gender: "male",
              })
              .select(`
                id,
                family_id,
                first_name,
                middle_name,
                last_name,
                name_parts,
                gender,
                birth_date,
                death_date,
                birth_place,
                death_place,
                bio,
                photo_url
              `)
              .single();

          if (ancestorError) {
            console.error(
              "Create ancestor error:",
              ancestorError
            );

            /*
              نحاول تنظيف الشخص الأساسي إذا فشل
              بناء السلسلة.
            */
            await supabase
              .from("people")
              .delete()
              .eq("id", createdPerson.id);

            return NextResponse.json(
              {
                success: false,
                message:
                  "تعذر بناء سلسلة النسب. لم يتم حفظ الشخص.",
              },
              { status: 500 }
            );
          }

          ancestor = createdAncestor;

          createdAncestors.push({
            id: ancestor.id,
            name: ancestorName,
          });
        }

        /*
          childPerson = الابن
          ancestor = الأب

          العلاقة الأولى:
          الابن -> الأب

          والعلاقة الثانية:
          الأب -> الابن
        */

        const { error: relationshipError } =
          await supabase
            .from("relationships")
            .insert([
              {
                person_id: childPerson.id,
                related_person_id: ancestor.id,
                relationship_type: "father",
              },
              {
                person_id: ancestor.id,
                related_person_id: childPerson.id,
                relationship_type: "child",
              },
            ]);

        if (relationshipError) {
          /*
            قد تكون إحدى العلاقات موجودة مسبقًا.
            نحاول التعامل معها بشكل آمن.
          */
          const duplicate =
            relationshipError.code === "23505";

          if (!duplicate) {
            console.error(
              "Create relationship error:",
              relationshipError
            );

            return NextResponse.json(
              {
                success: false,
                message:
                  "تمت إضافة الأشخاص لكن تعذر إكمال روابط النسب.",
              },
              { status: 500 }
            );
          }
        }

        childPerson = ancestor;

        /*
          نضيف الشخص الجديد إلى قائمة البحث
          حتى لا نكرر نفس الشخص في نفس العملية.
        */
        if (
          !existingPeople.some(
            (item) => item.id === ancestor.id
          )
        ) {
          existingPeople.push(ancestor);
        }
      }

      return NextResponse.json({
        success: true,
        message: "تمت إضافة الشخص وسلسلة النسب بنجاح.",
        person: createdPerson,
        createdAncestors,
        reusedAncestors,
      });
    }

    /*
    =====================================================
    إنشاء حساب لشخص موجود
    =====================================================
    */

    const personId = String(
      body.personId || ""
    ).trim();

    const username = String(
      body.username || ""
    ).trim();

    const password = String(
      body.password || ""
    );

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
          message:
            "اسم المستخدم يجب أن يكون 3 أحرف على الأقل.",
        },
        { status: 400 }
      );
    }

    if (username.length > 50) {
      return NextResponse.json(
        {
          success: false,
          message:
            "اسم المستخدم طويل جدًا.",
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
          message:
            "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          message:
            "كلمتا المرور غير متطابقتين.",
        },
        { status: 400 }
      );
    }

    const {
      data: person,
      error: personError,
    } = await supabase
      .from("people")
      .select(`
        id,
        family_id,
        first_name,
        middle_name,
        last_name,
        name_parts
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
          message:
            "تعذر التحقق من الشخص.",
        },
        { status: 500 }
      );
    }

    if (!person) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الشخص غير موجود.",
        },
        { status: 404 }
      );
    }

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
          message:
            "تعذر التحقق من حساب الشخص.",
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
          message:
            "تعذر التحقق من اسم المستخدم.",
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

    const {
      data: createdAccount,
      error: createError,
    } = await supabase
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
          last_name,
          name_parts
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
          message:
            "تعذر إنشاء الحساب.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "تم إنشاء الحساب بنجاح.",
      account: createdAccount,
    });
  } catch (error) {
    console.error(
      "People POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ غير متوقع.",
      },
      { status: 500 }
    );
  }
}
