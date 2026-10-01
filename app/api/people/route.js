export const runtime = "nodejs";
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

    if (
      parts.length === 1 &&
      normalizeForCompare(parts[0]) ===
        normalizedAncestor
    ) {
      return true;
    }

    if (
      normalizeForCompare(buildFullName(person)) ===
      normalizedAncestor
    ) {
      return true;
    }

    return false;
  });

  if (!candidates.length) {
    return null;
  }

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

  if (
    candidates.length > 1 &&
    normalizedNextAncestor
  ) {
    for (const candidate of candidates) {
      const candidateFatherRelations =
        relationships.filter(
          (relationship) =>
            relationship.person_id === candidate.id &&
            relationship.relationship_type === "father"
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

  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

/*
=========================================================
UPLOAD PROFILE PHOTO
=========================================================
*/

async function uploadProfilePhoto({
  file,
  familyId,
  personId,
}) {
  if (!file) {
    return null;
  }

  if (
    typeof file.arrayBuffer !== "function" ||
    !file.name
  ) {
    throw new Error("ملف الصورة غير صالح.");
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error(
      "الملف المختار يجب أن يكون صورة."
    );
  }

  const maxSize =
    5 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(
      "حجم الصورة يجب ألا يتجاوز 5 ميجابايت."
    );
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";

  const safeExtension =
    extension || "jpg";

  const filePath =
    `${familyId}/${personId}/${Date.now()}-${cryptoRandomString(
      8
    )}.${safeExtension}`;

  const arrayBuffer =
    await file.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  const {
    error: uploadError,
  } = await supabase.storage
    .from("profile-photos")
    .upload(
      filePath,
      buffer,
      {
        contentType:
          file.type ||
          "image/jpeg",
        upsert: false,
        cacheControl:
          "3600",
      }
    );

  if (uploadError) {
    console.error(
      "Profile photo upload error:",
      uploadError
    );

    throw new Error(
      "تعذر رفع الصورة."
    );
  }

  const {
    data: publicUrlData,
  } =
    supabase.storage
      .from("profile-photos")
      .getPublicUrl(filePath);

  return (
    publicUrlData?.publicUrl ||
    null
  );
}

function cryptoRandomString(length = 8) {
  const chars =
    "abcdefghijklmnopqrstuvwxyz0123456789";

  let result = "";

  for (
    let index = 0;
    index < length;
    index++
  ) {
    result +=
      chars[
        Math.floor(
          Math.random() *
            chars.length
        )
      ];
  }

  return result;
}

/*
=========================================================
GET PEOPLE
=========================================================
*/

export async function GET() {
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

    const {
      data,
      error,
    } = await query;

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

يدعم:

1. JSON عادي لتعديل البيانات.
2. FormData عند رفع صورة.
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

    const contentType =
      request.headers.get(
        "content-type"
      ) || "";

    let body = {};
    let uploadedPhoto = null;

    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const formData =
        await request.formData();

      body = {
        personId:
          formData.get("personId"),
        fullName:
          formData.get("fullName"),
        gender:
          formData.get("gender"),
        birth_date:
          formData.get("birth_date"),
        death_date:
          formData.get("death_date"),
        birth_place:
          formData.get("birth_place"),
        death_place:
          formData.get("death_place"),
        bio:
          formData.get("bio"),
      };

      const photo =
        formData.get("photo");

      if (
        photo &&
        typeof photo.arrayBuffer ===
          "function" &&
        photo.size > 0
      ) {
        uploadedPhoto = photo;
      }
    } else {
      body =
        await request.json();
    }

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
      typeof body.fullName ===
      "string"
    ) {
      const fullName =
        normalizeName(
          body.fullName
        );

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
        splitNameParts(
          fullName
        );

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
        getPersonNameParts(
          existingPerson
        );
    }

    const legacyFields =
      buildLegacyFields(
        nameParts
      );

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
      gender =
        body.gender;
    }

    /*
    =====================================================
    التواريخ
    =====================================================
    */

    const birthDate =
      body.birth_date !==
      undefined
        ? body.birth_date ||
          null
        : existingPerson.birth_date;

    const deathDate =
      body.death_date !==
      undefined
        ? body.death_date ||
          null
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
    الصورة
    =====================================================
    */

    let photoUrl =
      existingPerson.photo_url;

    if (uploadedPhoto) {
      try {
        photoUrl =
          await uploadProfilePhoto({
            file:
              uploadedPhoto,
            familyId:
              existingPerson.family_id,
            personId,
          });
      } catch (photoError) {
        console.error(
          "Profile photo error:",
          photoError
        );

        return NextResponse.json(
          {
            success: false,
            message:
              photoError.message ||
              "تعذر رفع الصورة.",
          },
          { status: 400 }
        );
      }
    }

    /*
    =====================================================
    البيانات الأخرى
    =====================================================
    */

    const updateData = {
      ...legacyFields,

      name_parts:
        nameParts,

      gender,

      birth_date:
        birthDate,

      death_date:
        deathDate,

      birth_place:
        body.birth_place !==
        undefined
          ? String(
              body.birth_place ||
                ""
            ).trim() || null
          : existingPerson.birth_place,

      death_place:
        body.death_place !==
        undefined
          ? String(
              body.death_place ||
                ""
            ).trim() || null
          : existingPerson.death_place,

      bio:
        body.bio !==
        undefined
          ? String(
              body.bio || ""
            ).trim() || null
          : existingPerson.bio,

      photo_url:
        photoUrl,

      updated_at:
        new Date().toISOString(),
    };

    /*
    =====================================================
    منع الاسم المكرر
    =====================================================
    */

    const {
      data: familyPeople,
      error:
        familyPeopleError,
    } = await supabase
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
      .neq(
        "id",
        personId
      );

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
      (
        familyPeople || []
      ).find(
        (person) =>
          normalizeForCompare(
            buildFullName(
              person
            )
          ) ===
          normalizedEditedName
      );

    if (duplicatePerson) {
      return NextResponse.json(
        {
          success: false,
          code:
            "PERSON_EXISTS",
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
      error:
        updateError,
    } = await supabase
      .from("people")
      .update(updateData)
      .eq(
        "id",
        personId
      )
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
      person:
        updatedPerson,
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

    let personId = "";

    const url =
      new URL(
        request.url
      );

    personId =
      url.searchParams.get(
        "id"
      ) || "";

    if (!personId) {
      try {
        const body =
          await request.json();

        personId = String(
          body.personId || ""
        ).trim();
      } catch {
        // لا يوجد body
      }
    }

    personId =
      String(
        personId || ""
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

    const {
      data: person,
      error:
        personError,
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
      .eq(
        "id",
        personId
      )
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

    const {
      error:
        deleteError,
    } = await supabase
      .from("people")
      .delete()
      .eq(
        "id",
        personId
      );

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

    const body =
      await request.json();

    const action = String(
      body.action ||
        "create-account"
    ).trim();

    /*
    =====================================================
    إنشاء شخص
    =====================================================
    */

    if (
      action ===
      "create-person"
    ) {
      const familyId =
        String(
          body.familyId ||
            account?.person
              ?.family_id ||
            ""
        ).trim();

      const fullName =
        normalizeName(
          body.fullName
        );

      const gender =
        body.gender ===
        "female"
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
        splitNameParts(
          fullName
        );

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
          .eq(
            "family_id",
            familyId
          ),

        supabase
          .from(
            "relationships"
          )
          .select(`
            id,
            person_id,
            related_person_id,
            relationship_type
          `),
      ]);

      if (
        existingPeopleResult.error
      ) {
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

      if (
        relationshipsResult.error
      ) {
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
        existingPeopleResult.data ||
        [];

      const relationships =
        relationshipsResult.data ||
        [];

      const normalizedFullName =
        normalizeForCompare(
          fullName
        );

      const exactExistingPerson =
        existingPeople.find(
          (item) =>
            normalizeForCompare(
              buildFullName(item)
            ) ===
            normalizedFullName
        );

      if (exactExistingPerson) {
        return NextResponse.json(
          {
            success: false,
            code:
              "PERSON_EXISTS",
            message:
              "هذا الشخص موجود بالفعل في العائلة.",
            person:
              exactExistingPerson,
          },
          { status: 409 }
        );
      }

      const mainFields =
        buildLegacyFields(
          nameParts
        );

      const {
        data:
          createdPerson,
        error:
          createPersonError,
      } = await supabase
        .from("people")
        .insert({
          family_id:
            familyId,
          ...mainFields,
          name_parts:
            nameParts,
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

      if (
        createPersonError
      ) {
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

      existingPeople.push(
        createdPerson
      );

      let childPerson =
        createdPerson;

      const createdAncestors =
        [];

      const reusedAncestors =
        [];

      for (
        let index = 1;
        index <
        nameParts.length;
        index++
      ) {
        const ancestorName =
          nameParts[index];

        const nextAncestorName =
          nameParts[
            index + 1
          ] || null;

        let ancestor =
          await findExistingAncestor({
            people:
              existingPeople,
            relationships,
            ancestorName,
            nextAncestorName,
            childPersonId:
              childPerson.id,
          });

        if (!ancestor) {
          const ancestorFields =
            buildLegacyFields([
              ancestorName,
            ]);

          const {
            data:
              createdAncestor,
            error:
              ancestorError,
          } = await supabase
            .from("people")
            .insert({
              family_id:
                familyId,
              ...ancestorFields,
              name_parts: [
                ancestorName,
              ],
              gender:
                "male",
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

          if (
            ancestorError
          ) {
            console.error(
              "Create ancestor error:",
              ancestorError
            );

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
            id:
              ancestor.id,
            name:
              buildFullName(
                ancestor
              ),
          });

          existingPeople.push(
            ancestor
          );
        } else {
          reusedAncestors.push({
            id:
              ancestor.id,
            name:
              buildFullName(
                ancestor
              ),
          });
        }

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

        if (
          !fatherRelationExists
        ) {
          relationshipsToInsert.push({
            person_id:
              childPerson.id,
            related_person_id:
              ancestor.id,
            relationship_type:
              "father",
          });
        }

        if (
          !childRelationExists
        ) {
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
            .from(
              "relationships"
            )
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

          for (
            const relation of
              relationshipsToInsert
          ) {
            relationships.push({
              id: null,
              ...relation,
            });
          }
        }

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
    إنشاء حساب
    =====================================================
    */

    const personId =
      String(
        body.personId || ""
      ).trim();

    const username =
      String(
        body.username || ""
      ).trim();

    const password =
      String(
        body.password || ""
      );

    const confirmPassword =
      String(
        body.confirmPassword ||
          ""
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
      password !==
      confirmPassword
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
      error:
        personError,
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
      .eq(
        "id",
        personId
      )
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
      data:
        existingPersonAccount,
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

    if (
      existingPersonAccount
    ) {
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
      data:
        existingUsername,
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

    if (
      existingUsernameError
    ) {
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
      data:
        createdAccount,
      error:
        createError,
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
