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

function normalizeForCompare(value) {
  return normalizeName(value).toLocaleLowerCase("ar");
}

function splitNameParts(value) {
  return normalizeName(value)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildFullName(person) {
  if (
    Array.isArray(person?.name_parts) &&
    person.name_parts.length
  ) {
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

function getPersonNameParts(person) {
  if (
    Array.isArray(person?.name_parts) &&
    person.name_parts.length
  ) {
    return person.name_parts;
  }

  return [
    person?.first_name,
    person?.middle_name,
    person?.last_name,
  ].filter(Boolean);
}

/*
=========================================================
FIND ANCESTOR
=========================================================

نبحث عن الأب الموجود بدل إنشاء نسخة جديدة.

الأولوية:

1. شخص له نفس الاسم تمامًا وكان مرتبطًا
   بالفعل كأب للشخص الحالي.

2. شخص اسمه مطابق تمامًا للاسم المطلوب
   وكان أبوه هو الاسم التالي في السلسلة.

3. شخص يحمل الاسم المطلوب كاسم منفرد.

4. إذا لم نستطع تحديد شخص موجود بشكل آمن:
   يتم إنشاء شخص جديد.
=========================================================
*/

async function findExistingAncestor({
  people,
  relationships,
  ancestorName,
  nextAncestorName,
  childPersonId,
}) {
  const normalizedAncestor =
    normalizeForCompare(ancestorName);

  const normalizedNextAncestor =
    normalizeForCompare(nextAncestorName);

  const candidates = people.filter((person) => {
    if (person.gender !== "male") {
      return false;
    }

    const parts = getPersonNameParts(person);

    /*
      الاسم المفرد هو الشكل الذي ينشئه النظام
      تلقائيًا للآباء الذين تم اكتشافهم.
    */
    if (
      parts.length === 1 &&
      normalizeForCompare(parts[0]) ===
        normalizedAncestor
    ) {
      return true;
    }

    /*
      كذلك نسمح بمطابقة الاسم الكامل إذا كان
      الشخص مسجلًا مسبقًا ببيانات أكثر تفصيلًا.
    */
    if (
      normalizeForCompare(buildFullName(person)) ===
      normalizedAncestor
    ) {
      return true;
    }

    /*
      وأيضًا إذا كان الاسم المطلوب هو الاسم الأول
      للشخص المسجل، نحتفظ به كمرشح فقط.
      لا يتم اختياره إلا إذا دعمه سياق النسب.
    */
    return false;
  });

  if (!candidates.length) {
    return null;
  }

  /*
  =======================================================
  حالة مهمة:
  إذا كان هذا الأب مرتبطًا بالفعل بالابن الحالي،
  نعيد استخدامه مباشرة.
  =======================================================
  */

  const alreadyFather = candidates.find((candidate) =>
    relationships.some(
      (relationship) =>
        relationship.person_id === childPersonId &&
        relationship.related_person_id === candidate.id &&
        relationship.relationship_type === "father"
    )
  );

  if (alreadyFather) {
    return alreadyFather;
  }

  /*
  =======================================================
  إذا كان هناك أكثر من مرشح، نحاول معرفة الأب
  الصحيح من خلال الأب التالي في سلسلة النسب.
  =======================================================
  */

  if (
    candidates.length > 1 &&
    normalizedNextAncestor
  ) {
    for (const candidate of candidates) {
      const candidateFatherRelations =
        relationships.filter(
          (relationship) =>
            relationship.person_id === candidate.id &&
            relationship.relationship_type ===
              "father"
        );

      for (const fatherRelation of candidateFatherRelations) {
        const candidateFather = people.find(
          (person) =>
            person.id ===
            fatherRelation.related_person_id
        );

        if (!candidateFather) {
          continue;
        }

        const fatherParts =
          getPersonNameParts(candidateFather);

        const fatherName =
          fatherParts.length === 1
            ? fatherParts[0]
            : buildFullName(candidateFather);

        if (
          normalizeForCompare(fatherName) ===
          normalizedNextAncestor
        ) {
          return candidate;
        }
      }
    }
  }

  /*
  =======================================================
  إذا كان هناك شخص واحد فقط مطابق،
  نعيد استخدامه.
  =======================================================
  */

  if (candidates.length === 1) {
    return candidates[0];
  }

  /*
    أكثر من شخص بنفس الاسم ولا يوجد سياق كافٍ
    لتحديد الشخص الصحيح.
    لا نخمن هنا.
  */
  return null;
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
        updated_at,
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
      const familyId =
        account?.person?.family_id;

      if (!familyId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "تعذر تحديد العائلة المرتبطة بالحساب.",
          },
          { status: 400 }
        );
      }

      query = query.eq(
        "family_id",
        familyId
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "People GET error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر تحميل الأشخاص.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      people: data || [],
    });
  } catch (error) {
    console.error(
      "People GET error:",
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

/*
=========================================================
PATCH
=========================================================

تعديل بيانات شخص موجود.

المحرر فقط يستطيع تنفيذ العملية.
=========================================================
*/

export async function PATCH(request) {
  try {
    const account =
      await getCurrentAccount();

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
          message:
            "ليس لديك صلاحية تعديل الأشخاص.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const personId = String(
      body.personId || ""
    ).trim();

    if (!personId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الشخص المطلوب غير محدد.",
        },
        { status: 400 }
      );
    }

    /*
    =====================================================
    التحقق من الشخص
    =====================================================
    */

    const {
      data: existingPerson,
      error: existingPersonError,
    } = await supabase
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
      .eq("id", personId)
      .maybeSingle();

    if (existingPersonError) {
      console.error(
        "PATCH person lookup error:",
        existingPersonError
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

    if (!existingPerson) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الشخص غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
    =====================================================
    الاسم
    =====================================================
    */

    let nameParts;

    if (
      typeof body.fullName === "string"
    ) {
      const fullName =
        normalizeName(body.fullName);

      if (!fullName) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اسم الشخص مطلوب.",
          },
          { status: 400 }
        );
      }

      nameParts =
        splitNameParts(fullName);

      if (!nameParts.length) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اسم الشخص غير صالح.",
          },
          { status: 400 }
        );
      }
    } else {
      nameParts =
        getPersonNameParts(existingPerson);
    }

    const legacyFields =
      buildLegacyFields(nameParts);

    /*
    =====================================================
    الجنس
    =====================================================
    */

    let gender =
      existingPerson.gender;

    if (
      body.gender === "male" ||
      body.gender === "female"
    ) {
      gender = body.gender;
    }

    /*
    =====================================================
    التواريخ
    =====================================================
    */

    const birthDate =
      body.birth_date !== undefined
        ? body.birth_date || null
        : existingPerson.birth_date;

    const deathDate =
      body.death_date !== undefined
        ? body.death_date || null
        : existingPerson.death_date;

    if (
      birthDate &&
      deathDate &&
      new Date(deathDate) <
        new Date(birthDate)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تاريخ الوفاة لا يمكن أن يكون قبل تاريخ الميلاد.",
        },
        { status: 400 }
      );
    }

    /*
    =====================================================
    البيانات الأخرى
    =====================================================
    */

    const updateData = {
      ...legacyFields,
      name_parts: nameParts,
      gender,

      birth_date: birthDate,

      death_date: deathDate,

      birth_place:
        body.birth_place !== undefined
          ? String(
              body.birth_place || ""
            ).trim() || null
          : existingPerson.birth_place,

      death_place:
        body.death_place !== undefined
          ? String(
              body.death_place || ""
            ).trim() || null
          : existingPerson.death_place,

      bio:
        body.bio !== undefined
          ? String(
              body.bio || ""
            ).trim() || null
          : existingPerson.bio,

      photo_url:
        body.photo_url !== undefined
          ? String(
              body.photo_url || ""
            ).trim() || null
          : existingPerson.photo_url,

      updated_at:
        new Date().toISOString(),
    };

    /*
    =====================================================
    منع الاسم المكرر
    =====================================================
    */

    const { data: familyPeople, error: familyPeopleError } =
      await supabase
        .from("people")
        .select(`
          id,
          first_name,
          middle_name,
          last_name,
          name_parts
        `)
        .eq(
          "family_id",
          existingPerson.family_id
        )
        .neq("id", personId);

    if (familyPeopleError) {
      console.error(
        "PATCH duplicate lookup error:",
        familyPeopleError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر التحقق من الاسم.",
        },
        { status: 500 }
      );
    }

    const normalizedEditedName =
      normalizeForCompare(
        nameParts.join(" ")
      );

    const duplicatePerson =
      (familyPeople || []).find(
        (person) =>
          normalizeForCompare(
            buildFullName(person)
          ) === normalizedEditedName
      );

    if (duplicatePerson) {
      return NextResponse.json(
        {
          success: false,
          code: "PERSON_EXISTS",
          message:
            "يوجد شخص آخر بهذا الاسم في العائلة.",
        },
        { status: 409 }
      );
    }

    /*
    =====================================================
    UPDATE
    =====================================================
    */

    const {
      data: updatedPerson,
      error: updateError,
    } = await supabase
      .from("people")
      .update(updateData)
      .eq("id", personId)
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
        updated_at,
        account:accounts (
          id,
          username,
          role,
          is_active
        )
      `)
      .single();

    if (updateError) {
      console.error(
        "PATCH person update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر تعديل بيانات الشخص.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "تم تعديل بيانات الشخص بنجاح.",
      person: updatedPerson,
    });
  } catch (error) {
    console.error(
      "People PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ غير متوقع أثناء التعديل.",
      },
      { status: 500 }
    );
  }
}

/*
=========================================================
DELETE
=========================================================

يحذف الشخص المحدد فقط.

لا نحذف الأب أو الأبناء أو بقية أفراد العائلة.

قاعدة البيانات ستتعامل تلقائيًا مع:
- العلاقات المرتبطة بالشخص
- حسابه إن وجد
- روابط الأرشيف الخاصة به

أما ملف الأرشيف نفسه فلا يتم حذفه.
=========================================================
*/

export async function DELETE(request) {
  try {
    const account =
      await getCurrentAccount();

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
          message:
            "ليس لديك صلاحية حذف الأشخاص.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const personId = String(
      body.personId || ""
    ).trim();

    if (!personId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الشخص المطلوب حذفه غير محدد.",
        },
        { status: 400 }
      );
    }

    /*
    =====================================================
    التحقق من الشخص قبل الحذف
    =====================================================
    */

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
        name_parts,
        gender
      `)
      .eq("id", personId)
      .maybeSingle();

    if (personError) {
      console.error(
        "DELETE person lookup error:",
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

    /*
    =====================================================
    حذف الشخص نفسه فقط
    =====================================================
    */

    const {
      error: deleteError,
    } = await supabase
      .from("people")
      .delete()
      .eq("id", personId);

    if (deleteError) {
      console.error(
        "DELETE person error:",
        deleteError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر حذف الشخص.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "تم حذف الشخص بنجاح.",
      personId,
    });
  } catch (error) {
    console.error(
      "People DELETE error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ غير متوقع أثناء الحذف.",
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
    const account =
      await getCurrentAccount();

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
          message:
            "ليس لديك صلاحية تنفيذ هذا الإجراء.",
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
        body.familyId ||
          account?.person?.family_id ||
          ""
      ).trim();

      const fullName =
        normalizeName(body.fullName);

      const gender =
        body.gender === "female"
          ? "female"
          : "male";

      if (!familyId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "تعذر تحديد العائلة.",
          },
          { status: 400 }
        );
      }

      if (!fullName) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اكتب اسم الشخص كاملًا.",
          },
          { status: 400 }
        );
      }

      const nameParts =
        splitNameParts(fullName);

      if (!nameParts.length) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اسم الشخص غير صالح.",
          },
          { status: 400 }
        );
      }

      /*
      =====================================================
      تحميل الأشخاص الموجودين والعلاقات مرة واحدة
      =====================================================
      */

      const [
        existingPeopleResult,
        relationshipsResult,
      ] = await Promise.all([
        supabase
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
          .eq("family_id", familyId),

        supabase
          .from("relationships")
          .select(`
            id,
            person_id,
            related_person_id,
            relationship_type
          `),
      ]);

      if (existingPeopleResult.error) {
        console.error(
          "Existing people lookup error:",
          existingPeopleResult.error
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "تعذر البحث في أفراد العائلة.",
          },
          { status: 500 }
        );
      }

      if (relationshipsResult.error) {
        console.error(
          "Relationships lookup error:",
          relationshipsResult.error
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "تعذر تحميل علاقات النسب.",
          },
          { status: 500 }
        );
      }

      const existingPeople =
        existingPeopleResult.data || [];

      const relationships =
        relationshipsResult.data || [];

      /*
      =====================================================
      منع الشخص الأساسي من التكرار
      =====================================================
      */

      const normalizedFullName =
        normalizeForCompare(fullName);

      const exactExistingPerson =
        existingPeople.find(
          (item) =>
            normalizeForCompare(
              buildFullName(item)
            ) === normalizedFullName
        );

      if (exactExistingPerson) {
        return NextResponse.json(
          {
            success: false,
            code: "PERSON_EXISTS",
            message:
              "هذا الشخص موجود بالفعل في العائلة.",
            person:
              exactExistingPerson,
          },
          { status: 409 }
        );
      }

      /*
      =====================================================
      الشخص الأساسي
      =====================================================
      */

      const mainFields =
        buildLegacyFields(nameParts);

      const {
        data: createdPerson,
        error: createPersonError,
      } = await supabase
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
            message:
              "تعذر إضافة الشخص.",
          },
          { status: 500 }
        );
      }

      /*
        نضيف الشخص الجديد لقائمة الأشخاص
        حتى يمكن استخدامه في البحث أثناء
        بناء سلسلة النسب.
      */

      existingPeople.push(
        createdPerson
      );

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

      محمد = الشخص الجديد
      حلمي = الأب
      محمد = الجد
      حسين = جد الجد
      ...
      =====================================================
      */

      let childPerson =
        createdPerson;

      const createdAncestors = [];
      const reusedAncestors = [];

      for (
        let index = 1;
        index < nameParts.length;
        index++
      ) {
        const ancestorName =
          nameParts[index];

        const nextAncestorName =
          nameParts[index + 1] || null;

        /*
        ===================================================
        البحث عن الأب الموجود
        ===================================================
        */

        let ancestor =
          await findExistingAncestor({
            people: existingPeople,
            relationships,
            ancestorName,
            nextAncestorName,
            childPersonId:
              childPerson.id,
          });

        /*
        ===================================================
        إذا لم نجد الأب:
        ننشئه.
        ===================================================
        */

        if (!ancestor) {
          const ancestorFields =
            buildLegacyFields([
              ancestorName,
            ]);

          const {
            data: createdAncestor,
            error: ancestorError,
          } = await supabase
            .from("people")
            .insert({
              family_id: familyId,
              ...ancestorFields,
              name_parts: [
                ancestorName,
              ],
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
              نحذف الشخص الأساسي فقط.
              والآباء الذين تم إنشاؤهم
              في نفس العملية ستبقى إمكانية
              تنظيفهم هنا حسب نجاح العملية.
            */

            await supabase
              .from("people")
              .delete()
              .eq(
                "id",
                createdPerson.id
              );

            return NextResponse.json(
              {
                success: false,
                message:
                  "تعذر بناء سلسلة النسب. لم يتم حفظ الشخص.",
              },
              { status: 500 }
            );
          }

          ancestor =
            createdAncestor;

          createdAncestors.push({
            id: ancestor.id,
            name:
              buildFullName(
                ancestor
              ),
          });

          /*
            نضيف الأب الجديد إلى قائمة البحث
            حتى لا ينشأ مرة أخرى أثناء نفس
            العملية.
          */
          existingPeople.push(
            ancestor
          );
        } else {
          /*
            الأب موجود مسبقًا.
          */
          reusedAncestors.push({
            id: ancestor.id,
            name:
              buildFullName(
                ancestor
              ),
          });
        }

        /*
        ===================================================
        إنشاء العلاقة فقط إذا لم تكن موجودة
        ===================================================
        */

        const fatherRelationExists =
          relationships.some(
            (relationship) =>
              relationship.person_id ===
                childPerson.id &&
              relationship.related_person_id ===
                ancestor.id &&
              relationship.relationship_type ===
                "father"
          );

        const childRelationExists =
          relationships.some(
            (relationship) =>
              relationship.person_id ===
                ancestor.id &&
              relationship.related_person_id ===
                childPerson.id &&
              relationship.relationship_type ===
                "child"
          );

        const relationshipsToInsert =
          [];

        if (!fatherRelationExists) {
          relationshipsToInsert.push({
            person_id:
              childPerson.id,
            related_person_id:
              ancestor.id,
            relationship_type:
              "father",
          });
        }

        if (!childRelationExists) {
          relationshipsToInsert.push({
            person_id:
              ancestor.id,
            related_person_id:
              childPerson.id,
            relationship_type:
              "child",
          });
        }

        if (
          relationshipsToInsert.length
        ) {
          const {
            error:
              relationshipError,
          } = await supabase
            .from("relationships")
            .insert(
              relationshipsToInsert
            );

          if (
            relationshipError &&
            relationshipError.code !==
              "23505"
          ) {
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

          /*
            نضيف العلاقات للذاكرة الحالية
            حتى تستخدمها الخطوات التالية.
          */

          for (
            const relation
            of relationshipsToInsert
          ) {
            relationships.push({
              id: null,
              ...relation,
            });
          }
        }

        /*
          الآن الأب الحالي يصبح هو الابن
          للخطوة التالية حتى نصل إلى الجد.
        */

        childPerson =
          ancestor;
      }

      return NextResponse.json({
        success: true,
        message:
          "تمت إضافة الشخص وسلسلة النسب بنجاح.",
        person:
          createdPerson,
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

    const confirmPassword =
      String(
        body.confirmPassword || ""
      );

    if (!personId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الشخص المطلوب غير محدد.",
        },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          message:
            "اسم المستخدم مطلوب.",
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

    if (
      !/^[a-zA-Z0-9_.-]+$/.test(
        username
      )
    ) {
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
          message:
            "كلمة المرور مطلوبة.",
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

    if (
      password !== confirmPassword
    ) {
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
      error:
        existingPersonAccountError,
    } = await supabase
      .from("accounts")
      .select(
        "id, username"
      )
      .eq(
        "person_id",
        personId
      )
      .maybeSingle();

    if (
      existingPersonAccountError
    ) {
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
      error:
        existingUsernameError,
    } = await supabase
      .from("accounts")
      .select(
        "id, username"
      )
      .ilike(
        "username",
        username
      )
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

    const passwordHash =
      await bcrypt.hash(
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
        password_hash:
          passwordHash,
        person_id:
          personId,
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
      account:
        createdAccount,
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
