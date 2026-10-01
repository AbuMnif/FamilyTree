"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(date) {
  if (!date) {
    return null;
  }

  const value = new Date(`${date}T00:00:00`);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();

  return `${day}/${month}/${year}`;
}

function calculateAge(birthDate, deathDate = null) {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const end = deathDate
    ? new Date(`${deathDate}T00:00:00`)
    : new Date();

  if (Number.isNaN(end.getTime())) {
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

function getInitial(person) {
  return (
    person?.first_name?.charAt(0) ||
    person?.name_parts?.[0]?.charAt(0) ||
    "؟"
  );
}

export default function PeopleClient({
  account,
}) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [selectedPerson, setSelectedPerson] =
    useState(null);

  const [accountModalOpen, setAccountModalOpen] =
    useState(false);

  const [username, setUsername] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [creatingAccount, setCreatingAccount] =
    useState(false);

  const [accountMessage, setAccountMessage] =
    useState("");
  const [accountError, setAccountError] =
    useState("");

  /*
  =======================================================
  إضافة شخص جديد
  =======================================================
  */

  const [personModalOpen, setPersonModalOpen] =
    useState(false);

  const [newFullName, setNewFullName] =
    useState("");

  const [newGender, setNewGender] =
    useState("male");

  const [creatingPerson, setCreatingPerson] =
    useState(false);

  const [personCreateMessage, setPersonCreateMessage] =
    useState("");

  const [personCreateError, setPersonCreateError] =
    useState("");

  const [createdAncestors, setCreatedAncestors] =
    useState([]);

  const [reusedAncestors, setReusedAncestors] =
    useState([]);

  const isEditor =
    account?.role === "editor";

  const person = account?.person;

  const currentFullName =
    getFullName(person);

  async function loadPeople() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/people",
        {
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ||
            "تعذر تحميل أفراد العائلة."
        );
        return;
      }

      setPeople(data.people || []);
    } catch (error) {
      console.error(
        "Load people error:",
        error
      );

      setError(
        "تعذر الاتصال بالخادم. حاول مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  const filteredPeople =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      if (!value) {
        return people;
      }

      return people.filter((item) => {
        const name =
          getFullName(item).toLowerCase();

        return name.includes(value);
      });
    }, [people, search]);

  /*
  =======================================================
  إضافة شخص
  =======================================================
  */

  function openPersonCreateModal() {
    setNewFullName("");
    setNewGender("male");
    setPersonCreateMessage("");
    setPersonCreateError("");
    setCreatedAncestors([]);
    setReusedAncestors([]);
    setPersonModalOpen(true);
  }

  function closePersonCreateModal() {
    if (creatingPerson) {
      return;
    }

    setPersonModalOpen(false);
  }

  async function createPerson(event) {
    event.preventDefault();

    if (!isEditor) {
      return;
    }

    setPersonCreateMessage("");
    setPersonCreateError("");
    setCreatedAncestors([]);
    setReusedAncestors([]);

    const fullName =
      newFullName
        .trim()
        .replace(/\s+/g, " ");

    if (!fullName) {
      setPersonCreateError(
        "اكتب اسم الشخص كاملًا."
      );
      return;
    }

    const parts =
      fullName
        .split(" ")
        .filter(Boolean);

    if (parts.length < 1) {
      setPersonCreateError(
        "اسم الشخص غير صالح."
      );
      return;
    }

    setCreatingPerson(true);

    try {
      const response =
        await fetch(
          "/api/people",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action:
                "create-person",
              fullName,
              gender:
                newGender,
              familyId:
                account?.person
                  ?.family_id,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        setPersonCreateError(
          data.message ||
            "تعذر إضافة الشخص."
        );

        return;
      }

      setPersonCreateMessage(
        data.message ||
          "تمت إضافة الشخص وسلسلة النسب بنجاح."
      );

      setCreatedAncestors(
        data.createdAncestors ||
          []
      );

      setReusedAncestors(
        data.reusedAncestors ||
          []
      );

      await loadPeople();

      setNewFullName("");
    } catch (error) {
      console.error(
        "Create person error:",
        error
      );

      setPersonCreateError(
        "تعذر الاتصال بالخادم."
      );
    } finally {
      setCreatingPerson(false);
    }
  }

  /*
  =======================================================
  عرض شخص
  =======================================================
  */

  function openPerson(personData) {
    setSelectedPerson(personData);
    setAccountModalOpen(false);
    setAccountMessage("");
    setAccountError("");
  }

  function closePerson() {
    setSelectedPerson(null);
    setAccountModalOpen(false);
    setAccountMessage("");
    setAccountError("");
  }

  /*
  =======================================================
  حساب الشخص
  =======================================================
  */

  function openAccountModal() {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setAccountMessage("");
    setAccountError("");
    setAccountModalOpen(true);
  }

  function closeAccountModal() {
    if (creatingAccount) {
      return;
    }

    setAccountModalOpen(false);
  }

  async function createPersonAccount(
    event
  ) {
    event.preventDefault();

    if (
      !selectedPerson ||
      !isEditor
    ) {
      return;
    }

    setCreatingAccount(true);
    setAccountMessage("");
    setAccountError("");

    try {
      const response =
        await fetch(
          "/api/people",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action:
                "create-account",
              personId:
                selectedPerson.id,
              username:
                username.trim(),
              password,
              confirmPassword,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        setAccountError(
          data.message ||
            "تعذر إنشاء الحساب."
        );
        return;
      }

      setAccountMessage(
        "تم إنشاء حساب الشخص بنجاح."
      );

      setSelectedPerson(
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            account:
              data.account,
          };
        }
      );

      setPeople(
        (currentPeople) =>
          currentPeople.map(
            (item) =>
              item.id ===
              selectedPerson.id
                ? {
                    ...item,
                    account:
                      data.account,
                  }
                : item
          )
      );

      setUsername("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(
        "Create person account error:",
        error
      );

      setAccountError(
        "تعذر الاتصال بالخادم."
      );
    } finally {
      setCreatingAccount(false);
    }
  }

  return (
    <main className="people-page">

      <header className="people-header">

        <div className="people-header-main">

          <a
            href="/dashboard"
            className="back-button"
          >
            <span>→</span>
            الرئيسية
          </a>

          <div className="people-heading">

            <span>
              {isEditor
                ? "إدارة أفراد العائلة"
                : "أفراد العائلة"}
            </span>

            <h1>
              الأشخاص
            </h1>

            <p>
              استعرض أفراد العائلة ومعلوماتهم وحساباتهم.
            </p>

          </div>

        </div>

        <div className="people-header-account">

          <div>
            <strong>
              {currentFullName ||
                account?.username}
            </strong>

            <span>
              {isEditor
                ? "محرر النظام"
                : "مستخدم"}
            </span>
          </div>

          <div className="people-header-avatar">
            {getInitial(person)}
          </div>

        </div>

      </header>

      <section className="people-content">

        <div className="people-toolbar">

          <div className="people-count">

            <span>
              إجمالي الأشخاص
            </span>

            <strong>
              {people.length}
            </strong>

          </div>

          <div className="people-search">

            <span>
              ⌕
            </span>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="ابحث باسم الشخص..."
              aria-label="البحث عن شخص"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                aria-label="مسح البحث"
              >
                ×
              </button>
            )}

          </div>

          {isEditor && (
            <button
              type="button"
              className="create-person-button"
              onClick={
                openPersonCreateModal
              }
            >
              + إضافة شخص
            </button>
          )}

        </div>

        {loading && (
          <div className="people-state">

            <div className="people-loader" />

            <p>
              جاري تحميل أفراد العائلة...
            </p>

          </div>
        )}

        {!loading && error && (
          <div className="people-state people-state-error">

            <strong>
              تعذر تحميل الأشخاص
            </strong>

            <p>
              {error}
            </p>

            <button
              type="button"
              onClick={loadPeople}
            >
              المحاولة مرة أخرى
            </button>

          </div>
        )}

        {!loading &&
          !error &&
          filteredPeople.length === 0 && (
            <div className="people-state">

              <div className="empty-icon">
                ♙
              </div>

              <strong>
                {search
                  ? "لا توجد نتائج"
                  : "لا يوجد أشخاص بعد"}
              </strong>

              <p>
                {search
                  ? "جرّب البحث باسم مختلف."
                  : "لم تتم إضافة أفراد إلى العائلة بعد."}
              </p>

            </div>
          )}

        {!loading &&
          !error &&
          filteredPeople.length > 0 && (
            <div className="people-grid">

              {filteredPeople.map(
                (item) => {
                  const fullName =
                    getFullName(item);

                  const age =
                    calculateAge(
                      item.birth_date,
                      item.death_date
                    );

                  const hasAccount =
                    Boolean(
                      item.account
                    );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`person-card ${
                        item.death_date
                          ? "person-card-deceased"
                          : ""
                      }`}
                      onClick={() =>
                        openPerson(item)
                      }
                    >

                      <div className="person-card-top">

                        <div className="person-photo">

                          {item.photo_url ? (
                            <img
                              src={
                                item.photo_url
                              }
                              alt={
                                fullName
                              }
                            />
                          ) : (
                            <span>
                              {getInitial(
                                item
                              )}
                            </span>
                          )}

                        </div>

                        {hasAccount && (
                          <span className="account-badge">
                            حساب
                          </span>
                        )}

                      </div>

                      <div className="person-card-info">

                        <h2>
                          {fullName}
                        </h2>

                        <span className="person-gender">
                          {item.gender ===
                          "male"
                            ? "ذكر"
                            : "أنثى"}
                        </span>

                        {item.birth_date && (
                          <div className="person-meta">

                            <span>
                              الميلاد
                            </span>

                            <strong>
                              {formatDate(
                                item.birth_date
                              )}
                            </strong>

                          </div>
                        )}

                        {age !== null && (
                          <div className="person-age">
                            {item.death_date
                              ? `العمر عند الوفاة: ${age} سنة`
                              : `العمر: ${age} سنة`}
                          </div>
                        )}

                      </div>

                      <span className="person-card-arrow">
                        ←
                      </span>

                    </button>
                  );
                }
              )}

            </div>
          )}

      </section>

      {/*
      =====================================================
      MODAL إضافة شخص
      =====================================================
      */}

      {personModalOpen && (
        <div
          className="person-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePersonCreateModal();
            }
          }}
        >

          <section className="person-modal">

            <button
              type="button"
              className="person-modal-close"
              onClick={
                closePersonCreateModal
              }
              aria-label="إغلاق"
            >
              ×
            </button>

            <div className="person-modal-head">

              <div className="person-modal-photo">
                <span>
                  {newFullName
                    ?.trim()
                    ?.charAt(0) || "؟"}
                </span>
              </div>

              <div>

                <span>
                  إضافة جديد
                </span>

                <h2>
                  إضافة شخص
                </h2>

              </div>

            </div>

            <form
              onSubmit={createPerson}
            >

              <div
                className="person-create-info"
                style={{
                  marginBottom:
                    "18px",
                  padding:
                    "14px 16px",
                  borderRadius:
                    "16px",
                  background:
                    "#f7f5f1",
                  color:
                    "#555",
                  lineHeight:
                    "1.8",
                  fontSize:
                    "14px",
                }}
              >
                اكتب اسم الشخص كاملًا بالترتيب.
                <br />
                سيستخدم النظام الأسماء التي بعد
                الاسم الأول لبناء سلسلة الأب والجد
                وما بعدهما.
              </div>

              <label
                style={{
                  display:
                    "block",
                  marginBottom:
                    "16px",
                }}
              >
                <span
                  style={{
                    display:
                      "block",
                    marginBottom:
                      "8px",
                    fontWeight:
                      700,
                  }}
                >
                  الاسم الكامل
                </span>

                <input
                  type="text"
                  value={
                    newFullName
                  }
                  onChange={(
                    event
                  ) =>
                    setNewFullName(
                      event.target
                        .value
                    )
                  }
                  placeholder="مثال: محمد حلمي محمد حسين عبدالله العريفي"
                  autoFocus
                  dir="rtl"
                  disabled={
                    creatingPerson
                  }
                  style={{
                    width:
                      "100%",
                    padding:
                      "14px 16px",
                    border:
                      "1px solid #ddd",
                    borderRadius:
                      "14px",
                    outline:
                      "none",
                    background:
                      "#fff",
                  }}
                />
              </label>

              <label
                style={{
                  display:
                    "block",
                  marginBottom:
                    "18px",
                }}
              >
                <span
                  style={{
                    display:
                      "block",
                    marginBottom:
                      "8px",
                    fontWeight:
                      700,
                  }}
                >
                  الجنس
                </span>

                <select
                  value={
                    newGender
                  }
                  onChange={(
                    event
                  ) =>
                    setNewGender(
                      event.target
                        .value
                    )
                  }
                  disabled={
                    creatingPerson
                  }
                  style={{
                    width:
                      "100%",
                    padding:
                      "14px 16px",
                    border:
                      "1px solid #ddd",
                    borderRadius:
                      "14px",
                    outline:
                      "none",
                    background:
                      "#fff",
                  }}
                >
                  <option value="male">
                    ذكر
                  </option>

                  <option value="female">
                    أنثى
                  </option>
                </select>
              </label>

              {newFullName
                .trim() && (
                <div
                  style={{
                    marginBottom:
                      "18px",
                    padding:
                      "16px",
                    borderRadius:
                      "16px",
                    background:
                      "#f7f5f1",
                  }}
                >
                  <strong
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "10px",
                    }}
                  >
                    معاينة سلسلة النسب
                  </strong>

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      gap:
                        "7px",
                    }}
                  >
                    {newFullName
                      .trim()
                      .replace(
                        /\s+/g,
                        " "
                      )
                      .split(" ")
                      .filter(Boolean)
                      .map(
                        (
                          part,
                          index
                        ) => (
                          <div
                            key={`${part}-${index}`}
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap:
                                "8px",
                            }}
                          >
                            <strong>
                              {
                                part
                              }
                            </strong>

                            {index <
                              newFullName
                                .trim()
                                .replace(
                                  /\s+/g,
                                  " "
                                )
                                .split(
                                  " "
                                )
                                .filter(
                                  Boolean
                                )
                                .length -
                                1 && (
                              <span
                                style={{
                                  color:
                                    "#999",
                                }}
                              >
                                ↓
                              </span>
                            )}

                          </div>
                        )
                      )}
                  </div>
                </div>
              )}

              {personCreateError && (
                <div
                  className="account-form-error"
                >
                  {
                    personCreateError
                  }
                </div>
              )}

              {personCreateMessage && (
                <div
                  className="account-form-success"
                  style={{
                    marginBottom:
                      "12px",
                  }}
                >
                  {
                    personCreateMessage
                  }
                </div>
              )}

              {createdAncestors.length >
                0 && (
                <div
                  style={{
                    marginBottom:
                      "12px",
                    padding:
                      "12px 14px",
                    borderRadius:
                      "14px",
                    background:
                      "#f7f5f1",
                    fontSize:
                      "14px",
                  }}
                >
                  <strong>
                    تم إنشاء الآباء:
                  </strong>

                  <div
                    style={{
                      marginTop:
                        "7px",
                    }}
                  >
                    {createdAncestors
                      .map(
                        (
                          item
                        ) =>
                          item.name
                      )
                      .join(
                        " ← "
                      )}
                  </div>
                </div>
              )}

              {reusedAncestors.length >
                0 && (
                <div
                  style={{
                    marginBottom:
                      "12px",
                    padding:
                      "12px 14px",
                    borderRadius:
                      "14px",
                    background:
                      "#f7f5f1",
                    fontSize:
                      "14px",
                  }}
                >
                  <strong>
                    أشخاص موجودون مسبقًا:
                  </strong>

                  <div
                    style={{
                      marginTop:
                        "7px",
                    }}
                  >
                    {reusedAncestors
                      .map(
                        (
                          item
                        ) =>
                          item.name
                      )
                      .join(
                        "، "
                      )}
                  </div>
                </div>
              )}

              <div className="account-form-actions">

                <button
                  type="button"
                  className="account-cancel-button"
                  onClick={
                    closePersonCreateModal
                  }
                  disabled={
                    creatingPerson
                  }
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="account-submit-button"
                  disabled={
                    creatingPerson
                  }
                >
                  {creatingPerson
                    ? "جاري بناء النسب..."
                    : "إضافة وبناء النسب"}
                </button>

              </div>

            </form>

          </section>

        </div>
      )}

      {/*
      =====================================================
      MODAL الشخص الموجود
      =====================================================
      */}

      {selectedPerson && (
        <div
          className="person-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePerson();
            }
          }}
        >

          <section className="person-modal">

            <button
              type="button"
              className="person-modal-close"
              onClick={
                closePerson
              }
              aria-label="إغلاق"
            >
              ×
            </button>

            <div className="person-modal-head">

              <div className="person-modal-photo">

                {selectedPerson.photo_url ? (
                  <img
                    src={
                      selectedPerson.photo_url
                    }
                    alt={getFullName(
                      selectedPerson
                    )}
                  />
                ) : (
                  <span>
                    {getInitial(
                      selectedPerson
                    )}
                  </span>
                )}

              </div>

              <div>

                <span>
                  {selectedPerson.gender ===
                  "male"
                    ? "ذكر"
                    : "أنثى"}
                </span>

                <h2>
                  {getFullName(
                    selectedPerson
                  )}
                </h2>

              </div>

            </div>

            <div className="person-details">

              {selectedPerson.birth_date && (
                <div className="detail-item">

                  <span>
                    تاريخ الميلاد
                  </span>

                  <strong>
                    {formatDate(
                      selectedPerson.birth_date
                    )}
                  </strong>

                </div>
              )}

              {selectedPerson.death_date && (
                <div className="detail-item">

                  <span>
                    تاريخ الوفاة
                  </span>

                  <strong>
                    {formatDate(
                      selectedPerson.death_date
                    )}
                  </strong>

                </div>
              )}

              {calculateAge(
                selectedPerson.birth_date,
                selectedPerson.death_date
              ) !== null && (
                <div className="detail-item">

                  <span>
                    {selectedPerson.death_date
                      ? "العمر عند الوفاة"
                      : "العمر"}
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
                <div className="detail-item">

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
                <div className="detail-item">

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

            <div className="person-account-section">

              <div className="person-account-heading">

                <div>

                  <span>
                    الحساب
                  </span>

                  <h3>
                    حساب الدخول
                  </h3>

                </div>

                {selectedPerson.account && (
                  <span className="account-status">
                    {selectedPerson.account.is_active
                      ? "مفعّل"
                      : "غير مفعّل"}
                  </span>
                )}

              </div>

              {selectedPerson.account ? (
                <div className="existing-account">

                  <div className="existing-account-icon">
                    ✓
                  </div>

                  <div>

                    <span>
                      اسم المستخدم
                    </span>

                    <strong dir="ltr">
                      {
                        selectedPerson
                          .account
                          .username
                      }
                    </strong>

                  </div>

                </div>
              ) : isEditor ? (
                <div>

                  {!accountModalOpen ? (
                    <button
                      type="button"
                      className="create-account-button"
                      onClick={
                        openAccountModal
                      }
                    >
                      إنشاء حساب لهذا الشخص
                    </button>
                  ) : (
                    <form
                      className="account-form"
                      onSubmit={
                        createPersonAccount
                      }
                    >

                      <div className="account-form-title">
                        إنشاء حساب دخول
                      </div>

                      <label>
                        <span>
                          اسم المستخدم
                        </span>

                        <input
                          type="text"
                          value={
                            username
                          }
                          onChange={(
                            event
                          ) =>
                            setUsername(
                              event.target
                                .value
                            )
                          }
                          placeholder="مثال: ahmed1998"
                          autoComplete="off"
                          dir="ltr"
                          disabled={
                            creatingAccount
                          }
                        />
                      </label>

                      <label>
                        <span>
                          كلمة المرور
                        </span>

                        <input
                          type="password"
                          value={
                            password
                          }
                          onChange={(
                            event
                          ) =>
                            setPassword(
                              event.target
                                .value
                            )
                          }
                          placeholder="8 أحرف على الأقل"
                          autoComplete="new-password"
                          dir="ltr"
                          disabled={
                            creatingAccount
                          }
                        />
                      </label>

                      <label>
                        <span>
                          تأكيد كلمة المرور
                        </span>

                        <input
                          type="password"
                          value={
                            confirmPassword
                          }
                          onChange={(
                            event
                          ) =>
                            setConfirmPassword(
                              event.target
                                .value
                            )
                          }
                          placeholder="أعد كتابة كلمة المرور"
                          autoComplete="new-password"
                          dir="ltr"
                          disabled={
                            creatingAccount
                          }
                        />
                      </label>

                      {accountError && (
                        <div className="account-form-error">
                          {
                            accountError
                          }
                        </div>
                      )}

                      {accountMessage && (
                        <div className="account-form-success">
                          {
                            accountMessage
                          }
                        </div>
                      )}

                      <div className="account-form-actions">

                        <button
                          type="button"
                          className="account-cancel-button"
                          onClick={
                            closeAccountModal
                          }
                          disabled={
                            creatingAccount
                          }
                        >
                          إلغاء
                        </button>

                        <button
                          type="submit"
                          className="account-submit-button"
                          disabled={
                            creatingAccount
                          }
                        >
                          {creatingAccount
                            ? "جاري إنشاء الحساب..."
                            : "إنشاء الحساب"}
                        </button>

                      </div>

                    </form>
                  )}

                </div>
              ) : (
                <div className="no-account-message">
                  لا يوجد حساب دخول مرتبط بهذا الشخص.
                </div>
              )}

            </div>

            <div className="person-modal-actions">

              <a
                href={`/tree?person=${selectedPerson.id}`}
                className="view-tree-button"
              >
                عرض في شجرة العائلة
                <span>←</span>
              </a>

            </div>

          </section>

        </div>
      )}

    </main>
  );
}
