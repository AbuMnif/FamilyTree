"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date) {
  if (!date) return "غير محدد";

  const value = new Date(`${date}T00:00:00`);

  if (Number.isNaN(value.getTime())) {
    return date;
  }

  return value.toLocaleDateString("ar-SA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function calculateAge(birthDate, deathDate = null) {
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
    (monthDifference === 0 &&
      end.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age >= 0 ? age : null;
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
  return (
    person?.first_name?.trim()?.charAt(0) ||
    "؟"
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function PeopleClient({
  account,
}) {
  const isEditor =
    account?.role === "editor";

  /* =======================================================
     PEOPLE
  ======================================================= */

  const [people, setPeople] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  /* =======================================================
     SELECTED PERSON
  ======================================================= */

  const [selectedPerson, setSelectedPerson] =
    useState(null);

  /* =======================================================
     CREATE PERSON
  ======================================================= */

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [createLoading, setCreateLoading] =
    useState(false);

  const [createError, setCreateError] =
    useState("");

  const [createForm, setCreateForm] =
    useState({
      full_name: "",
      gender: "male",
      birth_date: "",
      death_date: "",
      birth_place: "",
      death_place: "",
      bio: "",
    });

  /* =======================================================
     CREATE ACCOUNT
  ======================================================= */

  const [showAccountModal, setShowAccountModal] =
    useState(false);

  const [accountPerson, setAccountPerson] =
    useState(null);

  const [accountLoading, setAccountLoading] =
    useState(false);

  const [accountError, setAccountError] =
    useState("");

  const [accountForm, setAccountForm] =
    useState({
      username: "",
      password: "",
      confirm_password: "",
    });

  /* =======================================================
     EDIT PERSON
  ======================================================= */

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [editLoading, setEditLoading] =
    useState(false);

  const [editError, setEditError] =
    useState("");

  const [editForm, setEditForm] =
    useState({
      id: "",
      full_name: "",
      gender: "male",
      birth_date: "",
      death_date: "",
      birth_place: "",
      death_place: "",
      bio: "",
    });

  const [editPhoto, setEditPhoto] =
    useState(null);

  const [editPhotoPreview, setEditPhotoPreview] =
    useState("");

  /* =======================================================
     DELETE
  ======================================================= */

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  /* =======================================================
     LOAD PEOPLE
  ======================================================= */

  async function loadPeople() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/people",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "تعذر تحميل الأشخاص."
        );
      }

      setPeople(data.people || []);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "حدث خطأ أثناء تحميل الأشخاص."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredPeople = useMemo(() => {
    const value =
      search.trim().toLowerCase();

    if (!value) {
      return people;
    }

    return people.filter((person) => {
      const fullName =
        getFullName(person).toLowerCase();

      return (
        fullName.includes(value) ||
        String(
          person.birth_place || ""
        )
          .toLowerCase()
          .includes(value) ||
        String(
          person.death_place || ""
        )
          .toLowerCase()
          .includes(value)
      );
    });
  }, [people, search]);

  /* =======================================================
     CREATE PERSON
  ======================================================= */

  function openPersonCreateModal() {
    setCreateError("");

    setCreateForm({
      full_name: "",
      gender: "male",
      birth_date: "",
      death_date: "",
      birth_place: "",
      death_place: "",
      bio: "",
    });

    setShowCreateModal(true);
  }

  function closePersonCreateModal() {
    if (createLoading) return;

    setShowCreateModal(false);
    setCreateError("");
  }

  async function createPerson(event) {
    event.preventDefault();

    try {
      setCreateLoading(true);
      setCreateError("");

      const response = await fetch(
        "/api/people",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            createForm
          ),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "تعذر إضافة الشخص."
        );
      }

      if (data.person) {
        setPeople((current) => [
          ...current,
          data.person,
        ]);
      } else {
        await loadPeople();
      }

      setShowCreateModal(false);

      setCreateForm({
        full_name: "",
        gender: "male",
        birth_date: "",
        death_date: "",
        birth_place: "",
        death_place: "",
        bio: "",
      });
    } catch (err) {
      console.error(err);

      setCreateError(
        err.message ||
          "حدث خطأ أثناء إضافة الشخص."
      );
    } finally {
      setCreateLoading(false);
    }
  }

  /* =======================================================
     PERSON DETAILS
  ======================================================= */

  function openPerson(person) {
    setSelectedPerson(person);
  }

  function closePerson() {
    setSelectedPerson(null);
  }

  /* =======================================================
     EDIT PERSON
  ======================================================= */

  function openEditModal(person) {
    if (!isEditor || !person) {
      return;
    }

    setEditError("");

    setEditForm({
      id: person.id,
      full_name: getFullName(person),
      gender: person.gender || "male",
      birth_date:
        person.birth_date || "",
      death_date:
        person.death_date || "",
      birth_place:
        person.birth_place || "",
      death_place:
        person.death_place || "",
      bio: person.bio || "",
    });

    setEditPhoto(null);

    setEditPhotoPreview(
      person.photo_url || ""
    );

    setShowEditModal(true);
  }

  function closeEditModal() {
    if (editLoading) return;

    setShowEditModal(false);
    setEditError("");

    if (
      editPhotoPreview &&
      editPhotoPreview.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        editPhotoPreview
      );
    }

    setEditPhoto(null);
    setEditPhotoPreview("");
  }

  function handleEditPhotoChange(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setEditError(
        "الملف المختار ليس صورة."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setEditError(
        "حجم الصورة يجب ألا يتجاوز 5 ميجابايت."
      );

      event.target.value = "";
      return;
    }

    setEditError("");

    if (
      editPhotoPreview &&
      editPhotoPreview.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        editPhotoPreview
      );
    }

    const preview =
      URL.createObjectURL(file);

    setEditPhoto(file);
    setEditPhotoPreview(preview);
  }

  async function updatePerson(event) {
    event.preventDefault();

    if (!isEditor) {
      return;
    }

    try {
      setEditLoading(true);
      setEditError("");

      const formData =
        new FormData();

      formData.append(
        "id",
        editForm.id
      );

      formData.append(
        "full_name",
        editForm.full_name
      );

      formData.append(
        "gender",
        editForm.gender
      );

      formData.append(
        "birth_date",
        editForm.birth_date
      );

      formData.append(
        "death_date",
        editForm.death_date
      );

      formData.append(
        "birth_place",
        editForm.birth_place
      );

      formData.append(
        "death_place",
        editForm.death_place
      );

      formData.append(
        "bio",
        editForm.bio
      );

      if (editPhoto) {
        formData.append(
          "photo",
          editPhoto
        );
      }

      const response = await fetch(
        "/api/people",
        {
          method: "PATCH",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "تعذر تعديل بيانات الشخص."
        );
      }

      const updatedPerson =
        data.person;

      if (updatedPerson) {
        setPeople((current) =>
          current.map((person) =>
            person.id ===
            updatedPerson.id
              ? updatedPerson
              : person
          )
        );

        setSelectedPerson(
          updatedPerson
        );
      } else {
        await loadPeople();
      }

      closeEditModal();
    } catch (err) {
      console.error(err);

      setEditError(
        err.message ||
          "حدث خطأ أثناء تعديل الشخص."
      );
    } finally {
      setEditLoading(false);
    }
  }

  /* =======================================================
     DELETE PERSON
  ======================================================= */

  async function deletePerson(person) {
    if (!isEditor || !person) {
      return;
    }

    const fullName =
      getFullName(person);

    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف "${fullName}"؟\n\nسيتم حذف الشخص من شجرة العائلة، وحذف حسابه وعلاقاته المرتبطة به.\n\nملفات الأرشيف نفسها لن يتم حذفها.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleteLoading(true);

      const response = await fetch(
        `/api/people?id=${encodeURIComponent(
          person.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "تعذر حذف الشخص."
        );
      }

      setPeople((current) =>
        current.filter(
          (item) =>
            item.id !== person.id
        )
      );

      setSelectedPerson(null);
    } catch (err) {
      console.error(err);

      window.alert(
        err.message ||
          "حدث خطأ أثناء حذف الشخص."
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  /* =======================================================
     ACCOUNT
  ======================================================= */

  function openAccountModal(person) {
    if (!person) return;

    setAccountPerson(person);

    setAccountError("");

    setAccountForm({
      username: "",
      password: "",
      confirm_password: "",
    });

    setShowAccountModal(true);
  }

  function closeAccountModal() {
    if (accountLoading) return;

    setShowAccountModal(false);
    setAccountPerson(null);
    setAccountError("");
  }

  async function createPersonAccount(
    event
  ) {
    event.preventDefault();

    if (!accountPerson) {
      return;
    }

    try {
      setAccountLoading(true);
      setAccountError("");

      const response = await fetch(
        "/api/accounts",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            person_id:
              accountPerson.id,
            username:
              accountForm.username,
            password:
              accountForm.password,
            confirm_password:
              accountForm.confirm_password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "تعذر إنشاء الحساب."
        );
      }

      closeAccountModal();
    } catch (err) {
      console.error(err);

      setAccountError(
        err.message ||
          "حدث خطأ أثناء إنشاء الحساب."
      );
    } finally {
      setAccountLoading(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="people-page">
      <div className="people-container">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="people-header">
          <div>
            <h1>أفراد العائلة</h1>

            <p>
              إدارة الأشخاص والبيانات
              الأساسية للعائلة.
            </p>
          </div>

          {isEditor && (
            <button
              type="button"
              className="primary-button"
              onClick={
                openPersonCreateModal
              }
            >
              + إضافة شخص
            </button>
          )}
        </div>

        {/* =================================================
            TOOLBAR
        ================================================= */}

        <div className="people-toolbar">
          <div className="search-box">
            <span>⌕</span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="ابحث عن شخص..."
            />
          </div>

          <div className="people-count">
            {filteredPeople.length} شخص
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (
          <div className="empty-state">
            <div className="loader" />
            <p>
              جاري تحميل أفراد العائلة...
            </p>
          </div>
        ) : filteredPeople.length ===
          0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              👤
            </div>

            <h3>
              لا يوجد أشخاص
            </h3>

            <p>
              لم يتم العثور على أي شخص
              مطابق للبحث.
            </p>
          </div>
        ) : (
          <div className="people-grid">
            {filteredPeople.map(
              (person) => {
                const age =
                  calculateAge(
                    person.birth_date,
                    person.death_date
                  );

                return (
                  <button
                    type="button"
                    className="person-card"
                    key={person.id}
                    onClick={() =>
                      openPerson(
                        person
                      )
                    }
                  >
                    <div className="person-avatar">
                      {person.photo_url ? (
                        <img
                          src={
                            person.photo_url
                          }
                          alt={getFullName(
                            person
                          )}
                        />
                      ) : (
                        <span>
                          {getInitial(
                            person
                          )}
                        </span>
                      )}
                    </div>

                    <div className="person-card-info">
                      <h3>
                        {getFullName(
                          person
                        )}
                      </h3>

                      <span>
                        {person.gender ===
                        "male"
                          ? "ذكر"
                          : "أنثى"}
                      </span>

                      {age !== null && (
                        <small>
                          {person.death_date
                            ? `العمر ${age} سنة`
                            : `العمر ${age} سنة`}
                        </small>
                      )}
                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          CREATE PERSON MODAL
      ===================================================== */}

      {showCreateModal && (
        <div
          className="modal-backdrop"
          onMouseDown={
            closePersonCreateModal
          }
        >
          <div
            className="modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  إضافة شخص
                </h2>

                <p>
                  أدخل بيانات الشخص الأساسية.
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={
                  closePersonCreateModal
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={createPerson}
            >
              <div className="form-group">
                <label>
                  الاسم الكامل
                </label>

                <input
                  value={
                    createForm.full_name
                  }
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        full_name:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="مثال: محمد أحمد علي"
                  required
                />

                <small>
                  سيستخدم النظام الاسم لبناء
                  تسلسل الأب والجد وما بعدهما.
                </small>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>
                    الجنس
                  </label>

                  <select
                    value={
                      createForm.gender
                    }
                    onChange={(event) =>
                      setCreateForm(
                        (current) => ({
                          ...current,
                          gender:
                            event.target
                              .value,
                        })
                      )
                    }
                  >
                    <option value="male">
                      ذكر
                    </option>

                    <option value="female">
                      أنثى
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    تاريخ الميلاد
                  </label>

                  <input
                    type="date"
                    value={
                      createForm.birth_date
                    }
                    onChange={(event) =>
                      setCreateForm(
                        (current) => ({
                          ...current,
                          birth_date:
                            event.target
                              .value,
                        })
                      )
                    }
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>
                    مكان الميلاد
                  </label>

                  <input
                    value={
                      createForm.birth_place
                    }
                    onChange={(event) =>
                      setCreateForm(
                        (current) => ({
                          ...current,
                          birth_place:
                            event.target
                              .value,
                        })
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    تاريخ الوفاة
                  </label>

                  <input
                    type="date"
                    value={
                      createForm.death_date
                    }
                    onChange={(event) =>
                      setCreateForm(
                        (current) => ({
                          ...current,
                          death_date:
                            event.target
                              .value,
                        })
                      )
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  مكان الوفاة
                </label>

                <input
                  value={
                    createForm.death_place
                  }
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        death_place:
                          event.target
                            .value,
                      })
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label>
                  نبذة
                </label>

                <textarea
                  rows="4"
                  value={
                    createForm.bio
                  }
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        bio: event.target
                          .value,
                      })
                    )
                  }
                />
              </div>

              {createError && (
                <div className="error-box">
                  {createError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closePersonCreateModal
                  }
                  disabled={
                    createLoading
                  }
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    createLoading
                  }
                >
                  {createLoading
                    ? "جاري الإضافة..."
                    : "إضافة الشخص"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          PERSON DETAILS MODAL
      ===================================================== */}

      {selectedPerson && (
        <div
          className="modal-backdrop"
          onMouseDown={
            closePerson
          }
        >
          <div
            className="modal person-details-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  بيانات الشخص
                </h2>

                <p>
                  التفاصيل الكاملة للشخص.
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={
                  closePerson
                }
              >
                ×
              </button>
            </div>

            <div className="person-details-top">
              <div className="person-details-avatar">
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
                <h2>
                  {getFullName(
                    selectedPerson
                  )}
                </h2>

                <p>
                  {selectedPerson.gender ===
                  "male"
                    ? "ذكر"
                    : "أنثى"}
                </p>
              </div>
            </div>

            <div className="details-grid">
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

              <div className="detail-item">
                <span>
                  العمر
                </span>

                <strong>
                  {calculateAge(
                    selectedPerson.birth_date,
                    selectedPerson.death_date
                  ) ??
                    "غير محدد"}{" "}
                  {calculateAge(
                    selectedPerson.birth_date,
                    selectedPerson.death_date
                  ) !== null
                    ? "سنة"
                    : ""}
                </strong>
              </div>

              <div className="detail-item">
                <span>
                  مكان الميلاد
                </span>

                <strong>
                  {selectedPerson.birth_place ||
                    "غير محدد"}
                </strong>
              </div>

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

              <div className="detail-item">
                <span>
                  مكان الوفاة
                </span>

                <strong>
                  {selectedPerson.death_place ||
                    "غير محدد"}
                </strong>
              </div>
            </div>

            {selectedPerson.bio && (
              <div className="bio-section">
                <h3>
                  نبذة
                </h3>

                <p>
                  {selectedPerson.bio}
                </p>
              </div>
            )}

            {isEditor && (
              <div className="editor-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    openEditModal(
                      selectedPerson
                    )
                  }
                >
                  تعديل البيانات
                </button>

                <button
                  type="button"
                  className="danger-button"
                  onClick={() =>
                    deletePerson(
                      selectedPerson
                    )
                  }
                  disabled={
                    deleteLoading
                  }
                >
                  {deleteLoading
                    ? "جاري الحذف..."
                    : "حذف الشخص"}
                </button>
              </div>
            )}

            <div className="person-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  openAccountModal(
                    selectedPerson
                  )
                }
              >
                إنشاء حساب
              </button>

              <a
                href={`/tree?person=${encodeURIComponent(
                  selectedPerson.id
                )}`}
                className="primary-button"
              >
                عرض في الشجرة
              </a>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          EDIT PERSON MODAL
      ===================================================== */}

      {showEditModal && (
        <div
          className="modal-backdrop"
          onMouseDown={
            closeEditModal
          }
        >
          <div
            className="modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  تعديل بيانات الشخص
                </h2>

                <p>
                  يمكنك تعديل البيانات والصورة
                  الشخصية.
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={
                  closeEditModal
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={updatePerson}
            >
              <div className="photo-upload">
                <div className="photo-preview">
                  {editPhotoPreview ? (
                    <img
                      src={
                        editPhotoPreview
                      }
                      alt="معاينة الصورة"
                    />
                  ) : (
                    <span>
                      {getInitial({
                        first_name:
                          editForm.full_name
                            .trim()
                            .split(/\s+/)[0],
                      })}
                    </span>
                  )}
                </div>

                <div className="photo-upload-content">
                  <label>
                    الصورة الشخصية
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={
                      handleEditPhotoChange
                    }
                  />

                  <small>
                    صورة واحدة، وبحد أقصى 5
                    ميجابايت.
                  </small>
                </div>
              </div>

              <div className="form-group">
                <label>
                  الاسم الكامل
                </label>

                <input
                  value={
                    editForm.full_name
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        full_name:
                          event.target
                            .value,
                      })
                    )
                  }
                  required
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>
                    الجنس
                  </label>

                  <select
                    value={
                      editForm.gender
                    }
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          gender:
                            event.target
                              .value,
                        })
                      )
                    }
                  >
                    <option value="male">
                      ذكر
                    </option>

                    <option value="female">
                      أنثى
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    تاريخ الميلاد
                  </label>

                  <input
                    type="date"
                    value={
                      editForm.birth_date
                    }
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          birth_date:
                            event.target
                              .value,
                        })
                      )
                    }
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>
                    مكان الميلاد
                  </label>

                  <input
                    value={
                      editForm.birth_place
                    }
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          birth_place:
                            event.target
                              .value,
                        })
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    تاريخ الوفاة
                  </label>

                  <input
                    type="date"
                    value={
                      editForm.death_date
                    }
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          death_date:
                            event.target
                              .value,
                        })
                      )
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  مكان الوفاة
                </label>

                <input
                  value={
                    editForm.death_place
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        death_place:
                          event.target
                            .value,
                      })
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label>
                  نبذة
                </label>

                <textarea
                  rows="4"
                  value={
                    editForm.bio
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        bio: event.target
                          .value,
                      })
                    )
                  }
                />
              </div>

              {editError && (
                <div className="error-box">
                  {editError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeEditModal
                  }
                  disabled={
                    editLoading
                  }
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    editLoading
                  }
                >
                  {editLoading
                    ? "جاري الحفظ..."
                    : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          ACCOUNT MODAL
      ===================================================== */}

      {showAccountModal &&
        accountPerson && (
          <div
            className="modal-backdrop"
            onMouseDown={
              closeAccountModal
            }
          >
            <div
              className="modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-header">
                <div>
                  <h2>
                    إنشاء حساب
                  </h2>

                  <p>
                    إنشاء حساب للشخص:
                    {" "}
                    <strong>
                      {getFullName(
                        accountPerson
                      )}
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  className="close-button"
                  onClick={
                    closeAccountModal
                  }
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  createPersonAccount
                }
              >
                <div className="form-group">
                  <label>
                    اسم المستخدم
                  </label>

                  <input
                    value={
                      accountForm.username
                    }
                    onChange={(event) =>
                      setAccountForm(
                        (current) => ({
                          ...current,
                          username:
                            event.target
                              .value,
                        })
                      )
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    كلمة المرور
                  </label>

                  <input
                    type="password"
                    value={
                      accountForm.password
                    }
                    onChange={(event) =>
                      setAccountForm(
                        (current) => ({
                          ...current,
                          password:
                            event.target
                              .value,
                        })
                      )
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    تأكيد كلمة المرور
                  </label>

                  <input
                    type="password"
                    value={
                      accountForm.confirm_password
                    }
                    onChange={(event) =>
                      setAccountForm(
                        (current) => ({
                          ...current,
                          confirm_password:
                            event.target
                              .value,
                        })
                      )
                    }
                    required
                  />
                </div>

                {accountError && (
                  <div className="error-box">
                    {accountError}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      closeAccountModal
                    }
                    disabled={
                      accountLoading
                    }
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      accountLoading
                    }
                  >
                    {accountLoading
                      ? "جاري الإنشاء..."
                      : "إنشاء الحساب"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </main>
  );
}
