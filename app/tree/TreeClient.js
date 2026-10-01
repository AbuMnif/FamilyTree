"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================================================
   HELPERS
========================================================= */

function getFullName(person) {
  if (
    Array.isArray(person?.name_parts) &&
    person.name_parts.length
  ) {
    return person.name_parts
      .filter(Boolean)
      .join(" ");
  }

  return [
    person?.first_name,
    person?.middle_name,
    person?.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function getFirstName(person) {
  if (person?.first_name) {
    return person.first_name;
  }

  if (
    Array.isArray(person?.name_parts) &&
    person.name_parts.length
  ) {
    return person.name_parts[0];
  }

  return "غير معروف";
}

function calculateAge(birthDate, deathDate) {
  if (!birthDate) return null;

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
    (
      monthDifference === 0 &&
      end.getDate() < birth.getDate()
    )
  ) {
    age--;
  }

  return Math.max(age, 0);
}

function formatGregorianDate(date) {
  if (!date) return null;

  const parts = String(date).split("-");

  if (parts.length !== 3) {
    return null;
  }

  return `${parts[2].padStart(2, "0")}/${parts[1].padStart(
    2,
    "0"
  )}/${parts[0]}`;
}

/* =========================================================
   TREE GRAPH
========================================================= */

function buildGraph(people, relationships) {
  const males = people.filter(
    (person) => person.gender === "male"
  );

  const peopleMap = new Map(
    males.map((person) => [
      person.id,
      person,
    ])
  );

  const fatherOf = new Map();
  const childrenOf = new Map();

  males.forEach((person) => {
    childrenOf.set(person.id, []);
  });

  relationships.forEach((relation) => {
    const a = relation.person_id;
    const b = relation.related_person_id;

    /*
     * person_id = الابن
     * related_person_id = الأب
     */
    if (
      relation.relationship_type === "father" &&
      peopleMap.has(a) &&
      peopleMap.has(b)
    ) {
      fatherOf.set(a, b);

      if (!childrenOf.has(b)) {
        childrenOf.set(b, []);
      }

      if (
        !childrenOf
          .get(b)
          .includes(a)
      ) {
        childrenOf.get(b).push(a);
      }
    }

    /*
     * person_id = الأب
     * related_person_id = الابن
     */
    if (
      relation.relationship_type === "child" &&
      peopleMap.has(a) &&
      peopleMap.has(b)
    ) {
      fatherOf.set(b, a);

      if (!childrenOf.has(a)) {
        childrenOf.set(a, []);
      }

      if (
        !childrenOf
          .get(a)
          .includes(b)
      ) {
        childrenOf.get(a).push(b);
      }
    }
  });

  /*
   * إزالة التكرار وترتيب الأبناء.
   */
  childrenOf.forEach((children, parentId) => {
    const unique = [
      ...new Set(children),
    ];

    unique.sort((a, b) => {
      const personA = peopleMap.get(a);
      const personB = peopleMap.get(b);

      return getFirstName(personA).localeCompare(
        getFirstName(personB),
        "ar"
      );
    });

    childrenOf.set(
      parentId,
      unique
    );
  });

  /*
   * حساب الجيل.
   */
  const generation = new Map();

  function findGeneration(
    personId,
    visited = new Set()
  ) {
    if (generation.has(personId)) {
      return generation.get(personId);
    }

    if (visited.has(personId)) {
      return 0;
    }

    visited.add(personId);

    const fatherId =
      fatherOf.get(personId);

    if (
      !fatherId ||
      !peopleMap.has(fatherId)
    ) {
      generation.set(personId, 0);
      return 0;
    }

    const level =
      findGeneration(
        fatherId,
        new Set(visited)
      ) + 1;

    generation.set(
      personId,
      level
    );

    return level;
  }

  males.forEach((person) => {
    findGeneration(person.id);
  });

  /*
   * تجميع حسب الأجيال.
   */
  const levels = new Map();

  males.forEach((person) => {
    const level =
      generation.get(person.id) || 0;

    if (!levels.has(level)) {
      levels.set(level, []);
    }

    levels
      .get(level)
      .push(person);
  });

  /*
   * ترتيب كل جيل بحسب الأب.
   */
  const orderedLevels = [
    ...levels.entries(),
  ]
    .sort(([a], [b]) => a - b)
    .map(([level, levelPeople]) => {
      return {
        level,
        people: levelPeople,
      };
    });

  const NODE_WIDTH = 140;
  const NODE_HEIGHT = 140;

  const HORIZONTAL_GAP = 95;
  const VERTICAL_GAP = 180;

  const nodes = [];
  const nodeMap = new Map();

  /*
   * لكل جيل نضع الأشخاص
   * في صف مستقل.
   */
  orderedLevels.forEach(
    ({ level, people: levelPeople }) => {
      const sorted = [...levelPeople];

      if (level > 0) {
        const previousLevel =
          orderedLevels.find(
            (item) =>
              item.level === level - 1
          );

        const previousPeople =
          previousLevel?.people || [];

        const previousIndex =
          new Map(
            previousPeople.map(
              (person, index) => [
                person.id,
                index,
              ]
            )
          );

        sorted.sort((a, b) => {
          const fatherA =
            fatherOf.get(a.id);

          const fatherB =
            fatherOf.get(b.id);

          const indexA =
            previousIndex.has(fatherA)
              ? previousIndex.get(fatherA)
              : 99999;

          const indexB =
            previousIndex.has(fatherB)
              ? previousIndex.get(fatherB)
              : 99999;

          if (indexA !== indexB) {
            return indexA - indexB;
          }

          return getFirstName(a).localeCompare(
            getFirstName(b),
            "ar"
          );
        });
      }

      const totalWidth =
        sorted.length * NODE_WIDTH +
        Math.max(
          0,
          sorted.length - 1
        ) * HORIZONTAL_GAP;

      sorted.forEach(
        (person, index) => {
          const x =
            1500 -
            totalWidth / 2 +
            NODE_WIDTH / 2 +
            index *
              (NODE_WIDTH +
                HORIZONTAL_GAP);

          const y =
            level * VERTICAL_GAP;

          const node = {
            ...person,
            x,
            y,
            generation: level,
          };

          nodes.push(node);
          nodeMap.set(
            person.id,
            node
          );
        }
      );
    }
  );

  /*
   * روابط الأبناء.
   */
  const connections = [];

  fatherOf.forEach(
    (fatherId, childId) => {
      const father =
        nodeMap.get(fatherId);

      const child =
        nodeMap.get(childId);

      if (!father || !child) {
        return;
      }

      connections.push({
        id: `${fatherId}-${childId}`,
        father,
        child,
      });
    }
  );

  return {
    nodes,
    connections,
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function TreeClient({
  account,
}) {
  const [people, setPeople] =
    useState([]);

  const [relationships, setRelationships] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [selectedPerson, setSelectedPerson] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [scale, setScale] =
    useState(0.8);

  const [position, setPosition] =
    useState({
      x: 0,
      y: 65,
    });

  const [dragging, setDragging] =
    useState(false);

  const [lastPointer, setLastPointer] =
    useState(null);

  const currentPersonId =
    account?.person?.id;

  /* =======================================================
     LOAD
  ======================================================= */

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
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err.message ||
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

  /* =======================================================
     GRAPH
  ======================================================= */

  const graph = useMemo(() => {
    return buildGraph(
      people,
      relationships
    );
  }, [
    people,
    relationships,
  ]);

  const peopleMap = useMemo(() => {
    return new Map(
      people.map((person) => [
        person.id,
        person,
      ])
    );
  }, [people]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const searchResults = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return people
      .filter((person) =>
        getFullName(person)
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 8);
  }, [
    people,
    search,
  ]);

  /* =======================================================
     RELATIONS
  ======================================================= */

  const selectedRelations =
    useMemo(() => {
      if (!selectedPerson) {
        return {
          father: null,
          mother: null,
          spouse: null,
          children: [],
        };
      }

      let father = null;
      let mother = null;
      let spouse = null;

      const children = [];

      relationships.forEach(
        (relation) => {
          if (
            relation.person_id ===
            selectedPerson.id
          ) {
            const related =
              peopleMap.get(
                relation.related_person_id
              );

            if (
              relation.relationship_type ===
              "father"
            ) {
              father = related || null;
            }

            if (
              relation.relationship_type ===
              "mother"
            ) {
              mother = related || null;
            }

            if (
              relation.relationship_type ===
              "spouse"
            ) {
              spouse = related || null;
            }

            if (
              relation.relationship_type ===
              "child"
            ) {
              if (
                related &&
                !children.some(
                  (item) =>
                    item.id ===
                    related.id
                )
              ) {
                children.push(
                  related
                );
              }
            }
          }

          if (
            relation.related_person_id ===
            selectedPerson.id
          ) {
            const related =
              peopleMap.get(
                relation.person_id
              );

            if (
              relation.relationship_type ===
                "father" &&
              !father
            ) {
              father =
                related || null;
            }

            if (
              relation.relationship_type ===
                "mother" &&
              !mother
            ) {
              mother =
                related || null;
            }

            if (
              relation.relationship_type ===
                "spouse" &&
              !spouse
            ) {
              spouse =
                related || null;
            }

            if (
              relation.relationship_type ===
              "child"
            ) {
              if (
                related &&
                !children.some(
                  (item) =>
                    item.id ===
                    related.id
                )
              ) {
                children.push(
                  related
                );
              }
            }
          }
        }
      );

      return {
        father,
        mother,
        spouse,
        children,
      };
    }, [
      selectedPerson,
      relationships,
      peopleMap,
    ]);

  /* =======================================================
     CONTROLS
  ======================================================= */

  function zoomIn() {
    setScale((value) =>
      Math.min(
        value + 0.1,
        1.8
      )
    );
  }

  function zoomOut() {
    setScale((value) =>
      Math.max(
        value - 0.1,
        0.35
      )
    );
  }

  function resetView() {
    setScale(0.8);

    setPosition({
      x: 0,
      y: 65,
    });
  }

  function handleWheel(event) {
    event.preventDefault();

    const change =
      event.deltaY > 0
        ? -0.05
        : 0.05;

    setScale((value) =>
      Math.min(
        Math.max(
          value + change,
          0.35
        ),
        1.8
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

    setDragging(true);

    setLastPointer({
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handlePointerMove(event) {
    if (
      !dragging ||
      !lastPointer
    ) {
      return;
    }

    const dx =
      event.clientX -
      lastPointer.x;

    const dy =
      event.clientY -
      lastPointer.y;

    setLastPointer({
      x: event.clientX,
      y: event.clientY,
    });

    setPosition((current) => ({
      x: current.x + dx,
      y: current.y + dy,
    }));
  }

  function handlePointerUp() {
    setDragging(false);
    setLastPointer(null);
  }

  function selectPerson(person) {
    setSelectedPerson(person);
    setSearch("");
  }

  function getRelationLabel(personId) {
    if (
      personId ===
      currentPersonId
    ) {
      return "أنت";
    }

    return null;
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="tree-page">

      {/* HEADER */}

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

            <span>
              ⌕
            </span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="ابحث عن شخص..."
            />

            {searchResults.length >
              0 && (
              <div className="search-results">

                {searchResults.map(
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
                        {getFirstName(
                          person
                        ).charAt(0)}
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

      {/* TOOLBAR */}

      <div className="tree-toolbar">

        <div className="tree-info">
          <strong>
            {graph.nodes.length}
          </strong>

          <span>
            رجلًا في الشجرة
          </span>
        </div>

        <div className="tree-controls">

          <button
            onClick={zoomIn}
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
          >
            −
          </button>

          <button
            className="reset-button"
            onClick={resetView}
          >
            إعادة ضبط
          </button>

        </div>

      </div>

      {/* TREE */}

      <section
        className={`tree-viewport ${
          dragging
            ? "is-dragging"
            : ""
        }`}
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
          graph.nodes.length === 0 && (
            <div className="tree-state">

              <strong>
                لا توجد بيانات في الشجرة
              </strong>

              <span>
                أضف أفراد العائلة من لوحة الإدارة.
              </span>

            </div>
          )}

        {!loading &&
          !error &&
          graph.nodes.length > 0 && (

          <div
            className="tree-canvas"
            style={{
              transform: `
                translate(
                  calc(-50% + ${position.x}px),
                  ${position.y}px
                )
                scale(${scale})
              `,
            }}
          >

            {/* LINES */}

            <svg
              className="tree-lines"
              viewBox="0 0 3000 2200"
              preserveAspectRatio="none"
            >

              {graph.connections.map(
                (connection) => {
                  const father =
                    connection.father;

                  const child =
                    connection.child;

                  const startX =
                    father.x;

                  const startY =
                    father.y + 140;

                  const endX =
                    child.x;

                  const endY =
                    child.y;

                  /*
                   * منحنى ناعم.
                   *
                   * لا توجد زوايا حادة.
                   */
                  const distance =
                    Math.abs(
                      endY -
                        startY
                    );

                  const curve =
                    Math.max(
                      45,
                      distance * 0.42
                    );

                  const path = `
                    M ${startX} ${startY}
                    C
                      ${startX} ${startY + curve}
                      ${endX} ${endY - curve}
                      ${endX} ${endY}
                  `;

                  return (
                    <path
                      key={
                        connection.id
                      }
                      d={path}
                      className="family-line"
                    />
                  );
                }
              )}

            </svg>

            {/* NODES */}

            <div className="tree-nodes">

              {graph.nodes.map(
                (person) => {
                  const relation =
                    getRelationLabel(
                      person.id
                    );

                  const isCurrent =
                    person.id ===
                    currentPersonId;

                  const isSelected =
                    selectedPerson?.id ===
                    person.id;

                  return (
                    <button
                      key={person.id}
                      className={`
                        family-tree-node
                        ${
                          isCurrent
                            ? "current-person"
                            : ""
                        }
                        ${
                          isSelected
                            ? "selected-person"
                            : ""
                        }
                      `}
                      style={{
                        left: `${person.x}px`,
                        top: `${person.y}px`,
                      }}
                      onClick={(event) => {
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
                            {getFirstName(
                              person
                            ).charAt(0)}
                          </span>
                        )}

                      </div>

                      <strong className="node-name">
                        {getFirstName(
                          person
                        )}
                      </strong>

                      {relation && (
                        <span className="node-relation">
                          {relation}
                        </span>
                      )}

                    </button>
                  );
                }
              )}

            </div>

          </div>
        )}

      </section>

      {/* PERSON PANEL */}

      {selectedPerson && (
        <aside className="person-panel">

          <button
            className="person-panel-close"
            onClick={() =>
              setSelectedPerson(null)
            }
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
                {getFirstName(
                  selectedPerson
                ).charAt(0)}
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
              <span>
                الجنس
              </span>

              <strong>
                {selectedPerson.gender ===
                "male"
                  ? "ذكر"
                  : "أنثى"}
              </strong>
            </div>

            {selectedPerson.birth_date && (
              <div>
                <span>
                  تاريخ الميلاد
                </span>

                <strong className="english-date">
                  {formatGregorianDate(
                    selectedPerson.birth_date
                  )}
                </strong>
              </div>
            )}

            {selectedPerson.death_date && (
              <div>
                <span>
                  تاريخ الوفاة
                </span>

                <strong className="english-date">
                  {formatGregorianDate(
                    selectedPerson.death_date
                  )}
                </strong>
              </div>
            )}

            {selectedPerson.birth_date && (
              <div>
                <span>
                  العمر
                </span>

                <strong>
                  {calculateAge(
                    selectedPerson.birth_date,
                    selectedPerson.death_date
                  )}{" "}
                  سنة
                </strong>
              </div>
            )}

            {selectedPerson.birth_place && (
              <div>
                <span>
                  مكان الميلاد
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
                  مكان الوفاة
                </span>

                <strong>
                  {
                    selectedPerson.death_place
                  }
                </strong>
              </div>
            )}

          </div>

          <div className="person-relations">

            <span className="person-relations-title">
              العلاقات العائلية
            </span>

            {selectedRelations.father && (
              <button
                className="person-relation-item"
                onClick={() =>
                  selectPerson(
                    selectedRelations.father
                  )
                }
              >
                <span>
                  الأب
                </span>

                <strong>
                  {getFullName(
                    selectedRelations.father
                  )}
                </strong>
              </button>
            )}

            {selectedRelations.mother && (
              <button
                className="person-relation-item"
                onClick={() =>
                  selectPerson(
                    selectedRelations.mother
                  )
                }
              >
                <span>
                  الأم
                </span>

                <strong>
                  {getFullName(
                    selectedRelations.mother
                  )}
                </strong>
              </button>
            )}

            {selectedRelations.spouse && (
              <button
                className="person-relation-item"
                onClick={() =>
                  selectPerson(
                    selectedRelations.spouse
                  )
                }
              >
                <span>
                  الزوج / الزوجة
                </span>

                <strong>
                  {getFullName(
                    selectedRelations.spouse
                  )}
                </strong>
              </button>
            )}

            {selectedRelations.children.length >
              0 && (
              <div className="person-children">

                <span>
                  الأبناء
                </span>

                <div>
                  {selectedRelations.children.map(
                    (child) => (
                      <button
                        key={child.id}
                        onClick={() =>
                          selectPerson(
                            child
                          )
                        }
                      >
                        {getFullName(
                          child
                        )}
                      </button>
                    )
                  )}
                </div>

              </div>
            )}

            {!selectedRelations.father &&
              !selectedRelations.mother &&
              !selectedRelations.spouse &&
              selectedRelations.children.length ===
                0 && (
              <p className="no-relations">
                لا توجد علاقات مسجلة لهذا الشخص.
              </p>
            )}

          </div>

          {selectedPerson.bio && (
            <div className="person-bio">

              <span>
                نبذة
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
