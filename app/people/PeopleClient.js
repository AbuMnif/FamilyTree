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

  let age = end.getFullYear() - birth.getFullYear();

  const monthDifference =
    end.getMonth() - birth.getMonth();

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
  return [
    person?.first_name,
    person?.middle_name,
    person?.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function getInitial(person) {
  return person?.first_name?.charAt(0) || "؟";
}

export default function PeopleClient({ account }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);

  const [accountModalOpen, setAccountModalOpen] =
    useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [creatingAccount, setCreatingAccount] =
    useState(false);

  const [accountMessage, setAccountMessage] =
    useState("");

  const [accountError, setAccountError] =
    useState("");

  const isEditor = account?.role === "editor";

  const person = account?.person;

  const currentFullName = getFullName(person);

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

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            "تعذر تحميل أفراد العائلة."
        );
        return;
      }

      setPeople(data.people || []);
    } catch (error) {
      console.error("Load people error:", error);

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

  const filteredPeople = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return people;
    }

    return people.filter((item) => {
      const name = getFullName(item).toLowerCase();

      return name.includes(value);
    });
  }, [people, search]);

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

  async function createPersonAccount(event) {
    event.preventDefault();

    if (!selectedPerson || !isEditor) {
      return;
    }

    setCreatingAccount(true);
    setAccountMessage("");
    setAccountError("");

    try {
      const response = await fetch(
        "/api/people",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personId: selectedPerson.id,
            username: username.trim(),
            password,
            confirmPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setAccountError(
          data.message ||
            "تعذر إنشاء الحساب."
        );
        return;
      }

      setAccountMessage(
        "تم إنشاء حساب الشخص بنجاح."
      );

      setSelectedPerson((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          account: data.account,
        };
      });

      setPeople((currentPeople) =>
        currentPeople.map((item) =>
          item.id === selectedPerson.id
            ? {
                ...item,
                account: data.account,
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
                setSearch(event.target.value)
              }
              placeholder="ابحث باسم الشخص..."
              aria-label="البحث عن شخص"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="مسح البحث"
              >
                ×
              </button>
            )}

          </div>

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

              {filteredPeople.map((item) => {
                const fullName =
                  getFullName(item);

                const age = calculateAge(
                  item.birth_date,
                  item.death_date
                );

                const hasAccount =
                  Boolean(item.account);

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
                            src={item.photo_url}
                            alt={fullName}
                          />
                        ) : (
                          <span>
                            {getInitial(item)}
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
                        {item.gender === "male"
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
              })}

            </div>
          )}

      </section>

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
              onClick={closePerson}
              aria-label="إغلاق"
            >
              ×
            </button>

            <div className="person-modal-head">

              <div className="person-modal-photo">

                {selectedPerson.photo_url ? (
                  <img
                    src={selectedPerson.photo_url}
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
                    {selectedPerson.birth_place}
                  </strong>

                </div>
              )}

              {selectedPerson.death_place && (
                <div className="detail-item">

                  <span>
                    مكان الوفاة
                  </span>

                  <strong>
                    {selectedPerson.death_place}
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
                        selectedPerson.account
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
                          value={username}
                          onChange={(event) =>
                            setUsername(
                              event.target.value
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
                          value={password}
                          onChange={(event) =>
                            setPassword(
                              event.target.value
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
                          onChange={(event) =>
                            setConfirmPassword(
                              event.target.value
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
                          {accountError}
                        </div>
                      )}

                      {accountMessage && (
                        <div className="account-form-success">
                          {accountMessage}
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
