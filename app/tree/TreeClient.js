"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function getFullName(person) {
  return [
    person?.first_name,
    person?.middle_name,
    person?.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function calculateAge(birthDate, deathDate) {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(`${birthDate}T00:00:00`);
  const end = deathDate
    ? new Date(`${deathDate}T00:00:00`)
    : new Date();

  if (
    Number.isNaN(birth.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }

  let age =
    end.getFullYear() -
    birth.getFullYear();

  const monthDifference =
    end.getMonth() -
    birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      end.getDate() < birth.getDate())
  ) {
    age--;
  }

  return Math.max(age, 0);
}

function formatGregorianDate(date) {
  if (!date) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString(
    "en-US",
    {
      calendar: "gregory",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}

function buildGraph(people, relationships) {
  const peopleMap = new Map(
    people.map((person) => [
      person.id,
      person,
    ])
  );

  const parents = new Map();
  const children = new Map();
  const spouses = new Map();

  people.forEach((person) => {
    parents.set(person.id, new Set());
    children.set(person.id, new Set());
    spouses.set(person.id, new Set());
  });

  relationships.forEach((relationship) => {
    const a = relationship.person_id;
    const b = relationship.related_person_id;

    if (
      !peopleMap.has(a) ||
      !peopleMap.has(b)
    ) {
      return;
    }

    if (
      relationship.relationship_type ===
        "father" ||
      relationship.relationship_type ===
        "mother"
    ) {
      parents.get(a)?.add(b);
      children.get(b)?.add(a);
    }

    if (
      relationship.relationship_type ===
      "child"
    ) {
      children.get(a)?.add(b);
      parents.get(b)?.add(a);
    }

    if (
      relationship.relationship_type ===
      "spouse"
    ) {
      spouses.get(a)?.add(b);
      spouses.get(b)?.add(a);
    }
  });

  const generation = new Map();

  function calculateGeneration(
    personId,
    visiting = new Set()
  ) {
    if (generation.has(personId)) {
      return generation.get(personId);
    }

    if (visiting.has(personId)) {
      return 0;
    }

    visiting.add(personId);

    const personParents = [
      ...(parents.get(personId) || []),
    ];

    if (!personParents.length) {
      generation.set(personId, 0);
      return 0;
    }

    const parentGenerations =
      personParents.map((parentId) =>
        calculateGeneration(
          parentId,
          new Set(visiting)
        )
      );

    const result =
      Math.max(...parentGenerations) + 1;

    generation.set(personId, result);

    return result;
  }

  people.forEach((person) => {
    calculateGeneration(person.id);
  });

  let changed = true;

  while (changed) {
    changed = false;

    people.forEach((person) => {
      const current =
        generation.get(person.id) || 0;

      for (const spouseId of
        spouses.get(person.id) || []) {
        const spouseGeneration =
          generation.get(spouseId) || 0;

        if (
          current !== spouseGeneration
        ) {
          const target = Math.max(
            current,
            spouseGeneration
          );

          if (
            generation.get(person.id) !==
            target
          ) {
            generation.set(
              person.id,
              target
            );

            changed = true;
          }

          if (
            generation.get(spouseId) !==
            target
          ) {
            generation.set(
              spouseId,
              target
            );

            changed = true;
          }
        }
      }
    });
  }

  const generationGroups = new Map();

  people.forEach((person) => {
    const level =
      generation.get(person.id) || 0;

    if (!generationGroups.has(level)) {
      generationGroups.set(level, []);
    }

    generationGroups
      .get(level)
      .push(person);
  });

  const sortedGenerations = [
    ...generationGroups.entries(),
  ].sort((a, b) => a[0] - b[0]);

  const nodes = [];

  const NODE_WIDTH = 180;
  const HORIZONTAL_GAP = 55;
  const VERTICAL_GAP = 185;

  sortedGenerations.forEach(
    ([level, generationPeople]) => {
      const totalWidth =
        generationPeople.length *
          NODE_WIDTH +
        Math.max(
          generationPeople.length - 1,
          0
        ) *
          HORIZONTAL_GAP;

      generationPeople.forEach(
        (person, index) => {
          const x =
            -totalWidth / 2 +
            NODE_WIDTH / 2 +
            index *
              (NODE_WIDTH +
                HORIZONTAL_GAP);

          const y =
            level * VERTICAL_GAP;

          nodes.push({
            ...person,
            x,
            y,
            generation: level,
          });
        }
      );
    }
  );

  return {
    nodes,
    relationships,
  };
}

export default function TreeClient({
  account,
}) {
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    selectedPerson,
    setSelectedPerson,
  ] = useState(null);

  const [search, setSearch] =
    useState("");

  const [scale, setScale] =
    useState(0.8);

  const [position, setPosition] =
    useState({
      x: 0,
      y: 80,
    });

  const draggingRef = useRef(false);

  const lastPointerRef = useRef({
    x: 0,
    y: 0,
  });

  const currentPersonId =
    account?.person?.id;

  useEffect(() => {
    let cancelled = false;

    async function loadTree() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/tree",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "تعذر تحميل شجرة العائلة."
          );
        }

        if (!cancelled) {
          setPeople(
            data.people || []
          );

          setRelationships(
            data.relationships || []
          );
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setError(
            error.message ||
              "تعذر تحميل شجرة العائلة."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTree();

    return () => {
      cancelled = true;
    };
  }, []);

  const graph = useMemo(() => {
    return buildGraph(
      people,
      relationships
    );
  }, [
    people,
    relationships,
  ]);

  const filteredPeople = useMemo(() => {
    const value =
      search.trim().toLowerCase();

    if (!value) {
      return [];
    }

    return people
      .filter((person) =>
        getFullName(person)
          .toLowerCase()
          .includes(value)
      )
      .slice(0, 8);
  }, [people, search]);

  function resetView() {
    setScale(0.8);

    setPosition({
      x: 0,
      y: 80,
    });
  }

  function zoomIn() {
    setScale((current) =>
      Math.min(
        current + 0.1,
        2
      )
    );
  }

  function zoomOut() {
    setScale((current) =>
      Math.max(
        current - 0.1,
        0.3
      )
    );
  }

  function selectPerson(person) {
    setSelectedPerson(person);
    setSearch("");
  }

  function handleWheel(event) {
    event.preventDefault();

    const direction =
      event.deltaY > 0
        ? -0.06
        : 0.06;

    setScale((current) =>
      Math.min(
        Math.max(
          current + direction,
          0.3
        ),
        2
      )
    );
  }

  function handlePointerDown(event) {
    if (
      event.target.closest(
        ".family-tree-node"
      )
    ) {
      return;
    }

    draggingRef.current = true;

    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    event.currentTarget.setPointerCapture?.(
      event.pointerId
    );
  }

  function handlePointerMove(event) {
    if (!draggingRef.current) {
      return;
    }

    const deltaX =
      event.clientX -
      lastPointerRef.current.x;

    const deltaY =
      event.clientY -
      lastPointerRef.current.y;

    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    setPosition((current) => ({
      x: current.x + deltaX,
      y: current.y + deltaY,
    }));
  }

  function handlePointerUp(event) {
    draggingRef.current = false;

    try {
      event.currentTarget.releasePointerCapture?.(
        event.pointerId
      );
    } catch {
      // Ignore pointer release errors.
    }
  }

  function getRelationshipLabel(
    personId
  ) {
    const relation =
      relationships.find(
        (item) =>
          item.person_id ===
            currentPersonId &&
          item.related_person_id ===
            personId
      );

    if (!relation) {
      return null;
    }

    if (
      relation.relationship_type ===
      "father"
    ) {
      return "والدي";
    }

    if (
      relation.relationship_type ===
      "mother"
    ) {
      return "والدتي";
    }

    if (
      relation.relationship_type ===
      "spouse"
    ) {
      return "زوجي / زوجتي";
    }

    if (
      relation.relationship_type ===
      "child"
    ) {
      return "ابني / ابنتي";
    }

    return null;
  }

  const nodeMap = new Map(
    graph.nodes.map((node) => [
      node.id,
      node,
    ])
  );

  const svgRelationships =
    relationships
      .filter((relationship) => {
        return (
          relationship.relationship_type ===
            "father" ||
          relationship.relationship_type ===
            "mother" ||
          relationship.relationship_type ===
            "child" ||
          relationship.relationship_type ===
            "spouse"
        );
      })
      .map((relationship) => {
        const from = nodeMap.get(
          relationship.person_id
        );

        const to = nodeMap.get(
          relationship.related_person_id
        );

        if (!from || !to) {
          return null;
        }

        return {
          ...relationship,
          from,
          to,
        };
      })
      .filter(Boolean);

  return (
    <main className="tree-page">

      <header className="tree-header">

        <div className="tree-header-title">

          <a
            href="/dashboard"
            className="tree-back"
          >
            ←
          </a>

          <div>
            <span>
              شجرة العائلة
            </span>

            <h1>
              العائلة
            </h1>
          </div>

        </div>

        <div className="tree-header-actions">

          <div className="tree-search">

            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="ابحث عن شخص..."
              aria-label="البحث عن شخص"
            />

            {filteredPeople.length >
              0 && (
              <div className="search-results">

                {filteredPeople.map(
                  (person) => (
                    <button
                      key={person.id}
                      onClick={() =>
                        selectPerson(
                          person
                        )
                      }
                    >
                      <span className="search-avatar">
                        {person.first_name?.charAt(
                          0
                        )}
                      </span>

                      <span>
                        {getFullName(
                          person
                        )}
                      </span>
                    </button>
                  )
                )}

              </div>
            )}

          </div>

          <a
            href="/dashboard"
            className="tree-dashboard-link"
          >
            لوحة التحكم
          </a>

        </div>

      </header>

      <div className="tree-toolbar">

        <div className="tree-info">

          <strong>
            {people.length}
          </strong>

          <span>
            شخصًا في الشجرة
          </span>

        </div>

        <div className="tree-controls">

          <button
            onClick={zoomIn}
            aria-label="تكبير"
          >
            +
          </button>

          <span>
            {Math.round(
              scale * 100
            )}
            %
          </span>

          <button
            onClick={zoomOut}
            aria-label="تصغير"
          >
            −
          </button>

          <button
            onClick={resetView}
            className="reset-button"
          >
            إعادة ضبط
          </button>

        </div>

      </div>

      <section
        className="tree-viewport"
        onWheel={handleWheel}
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
        onPointerCancel={
          handlePointerUp
        }
      >

        {loading && (
          <div className="tree-state">

            <div className="tree-loader" />

            <strong>
              جاري تحميل الشجرة...
            </strong>

            <span>
              يتم جلب بيانات العائلة
            </span>

          </div>
        )}

        {!loading && error && (
          <div className="tree-state tree-state-error">

            <strong>
              تعذر تحميل الشجرة
            </strong>

            <span>
              {error}
            </span>

            <button
              onClick={() =>
                window.location.reload()
              }
            >
              إعادة المحاولة
            </button>

          </div>
        )}

        {!loading &&
          !error &&
          people.length === 0 && (
            <div className="tree-state">

              <strong>
                لا يوجد أشخاص حتى الآن
              </strong>

              <span>
                أضف أفراد العائلة من لوحة الإدارة.
              </span>

            </div>
          )}

        {!loading &&
          !error &&
          people.length > 0 && (
            <div
              className="tree-canvas"
              style={{
                transform: `translate(
                  calc(-50% + ${position.x}px),
                  ${position.y}px
                ) scale(${scale})`,
              }}
            >

              <svg
                className="tree-lines"
                width="1"
                height="1"
                viewBox="-1500 -500 3000 2200"
                preserveAspectRatio="xMidYMin meet"
              >

                {svgRelationships.map(
                  (relationship) => {
                    const {
                      from,
                      to,
                      relationship_type,
                    } =
                      relationship;

                    const startX =
                      from.x;

                    const startY =
                      from.y + 112;

                    const endX =
                      to.x;

                    const endY =
                      to.y;

                    if (
                      relationship_type ===
                      "spouse"
                    ) {
                      const y =
                        Math.min(
                          from.y,
                          to.y
                        ) + 56;

                      return (
                        <line
                          key={
                            relationship.id
                          }
                          x1={startX}
                          y1={y}
                          x2={endX}
                          y2={y}
                          className="spouse-line"
                        />
                      );
                    }

                    const middleY =
                      startY +
                      (endY -
                        startY) /
                        2;

                    return (
                      <path
                        key={
                          relationship.id
                        }
                        d={`
                          M ${startX} ${startY}
                          C ${startX} ${middleY},
                            ${endX} ${middleY},
                            ${endX} ${endY}
                        `}
                        className="family-line"
                      />
                    );
                  }
                )}

              </svg>

              <div className="tree-nodes">

                {graph.nodes.map(
                  (person) => {
                    const isCurrent =
                      person.id ===
                      currentPersonId;

                    const relationshipLabel =
                      getRelationshipLabel(
                        person.id
                      );

                    const isSelected =
                      selectedPerson?.id ===
                      person.id;

                    return (
                      <button
                        key={person.id}
                        className={`family-tree-node ${
                          isCurrent
                            ? "current-person"
                            : ""
                        } ${
                          isSelected
                            ? "selected-person"
                            : ""
                        }`}
                        style={{
                          left: `calc(
                            50% + ${person.x}px
                          )`,
                          top: `${person.y}px`,
                        }}
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          selectPerson(
                            person
                          );
                        }}
                      >

                        <div className="node-photo">

                          {person.photo_url ? (
                            <img
                              src={
                                person.photo_url
                              }
                              alt=""
                            />
                          ) : (
                            <span>
                              {person.first_name?.charAt(
                                0
                              )}
                            </span>
                          )}

                        </div>

                        <div className="node-content">

                          <strong>
                            {getFullName(
                              person
                            )}
                          </strong>

                          {relationshipLabel && (
                            <span className="node-relation">
                              {
                                relationshipLabel
                              }
                            </span>
                          )}

                          {!relationshipLabel &&
                            isCurrent && (
                              <span className="node-relation">
                                أنت
                              </span>
                            )}

                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            </div>
          )}

      </section>

      {selectedPerson && (
        <aside className="person-panel">

          <button
            className="person-panel-close"
            onClick={() =>
              setSelectedPerson(
                null
              )
            }
            aria-label="إغلاق"
          >
            ×
          </button>

          <div className="person-panel-photo">

            {selectedPerson.photo_url ? (
              <img
                src={
                  selectedPerson.photo_url
                }
                alt=""
              />
            ) : (
              <span>
                {selectedPerson.first_name?.charAt(
                  0
                )}
              </span>
            )}

          </div>

          <span className="person-panel-label">
            معلومات الشخص
          </span>

          <h2>
            {getFullName(
              selectedPerson
            )}
          </h2>

          {selectedPerson.id ===
            currentPersonId && (
            <div className="you-badge">
              هذا حسابك
            </div>
          )}

          <div className="person-details">

            <div>
              <span>الجنس</span>

              <strong>
                {selectedPerson.gender ===
                "male"
                  ? "Male"
                  : "Female"}
              </strong>
            </div>

            {selectedPerson.birth_date && (
              <div>
                <span>
                  Birth date
                </span>

                <strong
                  className="english-date"
                >
                  {formatGregorianDate(
                    selectedPerson.birth_date
                  )}
                </strong>
              </div>
            )}

            {selectedPerson.death_date && (
              <div>
                <span>
                  Death date
                </span>

                <strong
                  className="english-date"
                >
                  {formatGregorianDate(
                    selectedPerson.death_date
                  )}
                </strong>
              </div>
            )}

            {selectedPerson.birth_date && (
              <div>
                <span>
                  {selectedPerson.death_date
                    ? "Age at death"
                    : "Age"}
                </span>

                <strong>
                  {calculateAge(
                    selectedPerson.birth_date,
                    selectedPerson.death_date
                  )}{" "}
                  years
                </strong>
              </div>
            )}

            {selectedPerson.birth_place && (
              <div>
                <span>
                  Birth place
                </span>

                <strong>
                  {
                    selectedPerson.birth_place
                  }
                </strong>
              </div>
            )}

            {selectedPerson.death_place && (
              <div>
                <span>
                  Death place
                </span>

                <strong>
                  {
                    selectedPerson.death_place
                  }
                </strong>
              </div>
            )}

          </div>

          {selectedPerson.bio && (
            <div className="person-bio">

              <span>
                Biography
              </span>

              <p>
                {selectedPerson.bio}
              </p>

            </div>
          )}

        </aside>
      )}

    </main>
  );
}
