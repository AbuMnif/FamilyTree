import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";

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

    const familyId =
      account.person?.family_id;

    if (!familyId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "لم يتم العثور على العائلة المرتبطة بالحساب.",
        },
        { status: 400 }
      );
    }

    const [
      peopleResult,
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
          gender,
          birth_date,
          death_date,
          birth_place,
          death_place,
          bio,
          photo_url
        `)
        .eq("family_id", familyId)
        .order("first_name", {
          ascending: true,
        }),

      supabase
        .from("relationships")
        .select(`
          id,
          person_id,
          related_person_id,
          relationship_type
        `),
    ]);

    if (peopleResult.error) {
      console.error(
        "Tree people error:",
        peopleResult.error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر تحميل أفراد العائلة.",
        },
        { status: 500 }
      );
    }

    if (relationshipsResult.error) {
      console.error(
        "Tree relationships error:",
        relationshipsResult.error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر تحميل علاقات العائلة.",
        },
        { status: 500 }
      );
    }

    const people = peopleResult.data || [];

    const peopleIds = new Set(
      people.map((person) => person.id)
    );

    /*
     * Only return relationships between
     * people belonging to this family.
     */
    const relationships = (
      relationshipsResult.data || []
    ).filter(
      (relationship) =>
        peopleIds.has(
          relationship.person_id
        ) &&
        peopleIds.has(
          relationship.related_person_id
        )
    );

    return NextResponse.json({
      success: true,
      people,
      relationships,
    });
  } catch (error) {
    console.error(
      "Tree API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء تحميل شجرة العائلة.",
      },
      { status: 500 }
    );
  }
}
