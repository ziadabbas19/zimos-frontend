import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, GraduationCap, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  ApiError,
  coursesCreate,
  coursesDelete,
  coursesEnroll,
  coursesGet,
  coursesList,
  coursesSaveOutline,
  coursesSetEnrollmentRevoked,
  coursesStudents,
  coursesUpdate,
  digitalListFiles,
  type Course,
  type CourseStudents,
  type DigitalFile,
  type LessonInput,
  type LessonKind,
  type ModuleInput,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { formatDate } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Courses",
    description: "Lessons your customers unlock by buying a product. They sign in on your store with their phone number.",
    add: "New course",
    emptyTitle: "No courses yet",
    emptyDescription: "Create a course, add its lessons, link it to the product that sells it, and publish.",
    lessons: "{count} lessons",
    students: "{count} students",
    draft: "Draft",
    published: "Published",
    open: "Open",
    createTitle: "New course",
    name: "Course title",
    back: "Courses",
    tabs: "Course editor",
    tabLessons: "Lessons",
    tabSettings: "Settings",
    tabStudents: "Students",
    addModule: "Add a chapter",
    addLesson: "Add a lesson",
    moduleTitle: "Chapter title",
    lessonTitle: "Lesson title",
    kind: "Type",
    kind_video: "Video",
    kind_text: "Text",
    kind_file: "File",
    videoUrl: "Video link",
    videoHint: "The player link from YouTube, Vimeo or Bunny.",
    body: "Text",
    file: "File",
    chooseFile: "Choose a file from the library",
    duration: "Minutes",
    dripDays: "Release after (days)",
    dripHint: "0 = available as soon as they enroll.",
    freePreview: "Free preview — anyone can open it",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    saveOutline: "Save lessons",
    outlineSaved: "Lessons saved.",
    noModules: "No chapters yet. Add the first one.",
    settingsSaved: "Course saved.",
    courseDescription: "Description",
    cover: "Cover picture link",
    product: "Sold through",
    noProduct: "Not linked to a product",
    productHint: "Whoever pays for this product is enrolled automatically.",
    status: "Status",
    studentLink: "Course page",
    copy: "Copy link",
    publish: "Publish",
    unpublish: "Back to draft",
    courseEmpty: "Add at least one lesson before publishing.",
    delete: "Delete course",
    deleteTitle: "Delete “{name}”?",
    deleteDescription: "The course and its lessons are removed for good.",
    hasStudents: "Students are enrolled in this course. Put it back to draft instead.",
    deleting: "Deleting…",
    enrollTitle: "Give access",
    phone: "Phone",
    studentName: "Name (optional)",
    enroll: "Enroll",
    noStudents: "No students yet.",
    progress: "{done} of {total} lessons",
    source_order: "Bought it",
    source_manual: "Added by you",
    revoke: "Remove access",
    restore: "Give back",
    revoked: "Access removed",
    invalidPhone: "Enter a valid phone number.",
  },
  ar: {
    title: "الكورسات",
    description: "دروس يفتحها عملاؤك بشراء منتج. يدخلون من متجرك برقم الهاتف.",
    add: "كورس جديد",
    emptyTitle: "لا توجد كورسات بعد",
    emptyDescription: "أنشئ كورسًا، أضف دروسه، اربطه بالمنتج الذي يبيعه، ثم انشره.",
    lessons: "{count} درس",
    students: "{count} طالب",
    draft: "مسودة",
    published: "منشور",
    open: "فتح",
    createTitle: "كورس جديد",
    name: "عنوان الكورس",
    back: "الكورسات",
    tabs: "محرر الكورس",
    tabLessons: "الدروس",
    tabSettings: "الإعدادات",
    tabStudents: "الطلاب",
    addModule: "إضافة فصل",
    addLesson: "إضافة درس",
    moduleTitle: "عنوان الفصل",
    lessonTitle: "عنوان الدرس",
    kind: "النوع",
    kind_video: "فيديو",
    kind_text: "نص",
    kind_file: "ملف",
    videoUrl: "رابط الفيديو",
    videoHint: "رابط المشغّل من يوتيوب أو فيميو أو Bunny.",
    body: "النص",
    file: "الملف",
    chooseFile: "اختر ملفًا من المكتبة",
    duration: "الدقائق",
    dripDays: "يُفتح بعد (أيام)",
    dripHint: "0 = متاح فور التسجيل.",
    freePreview: "معاينة مجانية — يفتحه أي زائر",
    moveUp: "تحريك لأعلى",
    moveDown: "تحريك لأسفل",
    remove: "حذف",
    saveOutline: "حفظ الدروس",
    outlineSaved: "تم حفظ الدروس.",
    noModules: "لا توجد فصول بعد. أضف أول فصل.",
    settingsSaved: "تم حفظ الكورس.",
    courseDescription: "الوصف",
    cover: "رابط صورة الغلاف",
    product: "يُباع عن طريق",
    noProduct: "غير مربوط بمنتج",
    productHint: "كل من يدفع ثمن هذا المنتج يُسجَّل تلقائيًا.",
    status: "الحالة",
    studentLink: "صفحة الكورس",
    copy: "نسخ الرابط",
    publish: "نشر",
    unpublish: "إرجاع لمسودة",
    courseEmpty: "أضف درسًا واحدًا على الأقل قبل النشر.",
    delete: "حذف الكورس",
    deleteTitle: "حذف «{name}»؟",
    deleteDescription: "يُحذف الكورس ودروسه نهائيًا.",
    hasStudents: "يوجد طلاب مسجلون في هذا الكورس. أرجعه لمسودة بدلًا من الحذف.",
    deleting: "جارٍ الحذف…",
    enrollTitle: "منح صلاحية الدخول",
    phone: "الهاتف",
    studentName: "الاسم (اختياري)",
    enroll: "تسجيل",
    noStudents: "لا يوجد طلاب بعد.",
    progress: "{done} من {total} درس",
    source_order: "اشترى",
    source_manual: "أضفته أنت",
    revoke: "سحب الصلاحية",
    restore: "إرجاع",
    revoked: "الصلاحية مسحوبة",
    invalidPhone: "اكتب رقم هاتف صحيح.",
  },
} satisfies Messages;

/** Courses (SPEC §18.3): the list, and one course's editor. */
export function CoursesPage() {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => coursesList(apiClient, workspaceId), [workspaceId]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (openId) {
    return (
      <CourseEditor
        courseId={openId}
        onBack={() => {
          setOpenId(null);
          void list.refresh({ silent: true });
        }}
      />
    );
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const course = await coursesCreate(apiClient, workspaceId, { title: name.trim() });
      setCreating(false);
      setName("");
      setOpenId(course.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const courses = list.data ?? [];
  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            {t.add}
          </Button>
        }
      />
      <DataState skeleton={<ListSkeleton />} loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {courses.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="size-6" aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={<Button onClick={() => setCreating(true)}>{t.add}</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Card key={course.id} className="gap-0 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 dir="auto" className="min-w-0 text-base font-semibold text-ink">
                    {course.title}
                  </h2>
                  <StatusBadge value={course.status} tone={course.status === "published" ? "success" : "neutral"} text={t[course.status]} />
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {fmt(t.lessons, { count: course.lessonsCount ?? 0 })} · {fmt(t.students, { count: course.studentsCount ?? 0 })}
                </p>
                <div className="mt-4">
                  <Button size="sm" variant="outline" className="min-h-9" onClick={() => setOpenId(course.id)}>
                    {t.open}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title={t.createTitle}>
        <form onSubmit={create} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <TextField label={t.name} required value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              {common.cancel}
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? common.saving : common.create}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CourseEditor({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const detail = useAsync(() => coursesGet(apiClient, workspaceId, courseId), [workspaceId, courseId]);
  const [tab, setTab] = useState<"lessons" | "settings" | "students">("lessons");
  const course = detail.data;

  return (
    <div className="max-w-4xl">
      <div className="mb-2">
        <button type="button" onClick={onBack} className="cursor-pointer text-sm text-ink-soft hover:text-primary">
          ← {t.back}
        </button>
      </div>
      <PageHeader
        title={course?.title ?? t.title}
        titleBadge={course ? <StatusBadge value={course.status} tone={course.status === "published" ? "success" : "neutral"} text={t[course.status]} /> : undefined}
      />
      <DataState loading={detail.loading} error={detail.error} onRetry={() => void detail.refresh()}>
        {course && (
          <>
            <FilterTabs
              className="mb-4"
              label={t.tabs}
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "lessons", label: t.tabLessons },
                { value: "settings", label: t.tabSettings },
                { value: "students", label: t.tabStudents },
              ]}
            />
            {tab === "lessons" && <OutlineTab course={course} onSaved={(saved) => detail.setData(saved)} />}
            {tab === "settings" && <SettingsTab course={course} onSaved={(saved) => detail.setData(saved)} onDeleted={onBack} />}
            {tab === "students" && <StudentsTab courseId={course.id} />}
          </>
        )}
      </DataState>
    </div>
  );
}

type DraftLesson = LessonInput & { key: string };
type DraftModule = { id?: string; key: string; title: string; lessons: DraftLesson[] };
let draftSeq = 0;
const newKey = () => `draft-${++draftSeq}`;

function toDraft(course: Course): DraftModule[] {
  return (course.modules ?? []).map((m) => ({
    id: m.id,
    key: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      key: l.id,
      title: l.title,
      kind: l.kind,
      videoUrl: l.videoUrl ?? "",
      body: l.body ?? "",
      fileId: l.fileId,
      durationSeconds: l.durationSeconds,
      isFreePreview: l.isFreePreview,
      dripDays: l.dripDays,
    })),
  }));
}

function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function OutlineTab({ course, onSaved }: { course: Course; onSaved: (course: Course) => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [modules, setModules] = useState<DraftModule[]>(() => toDraft(course));
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    digitalListFiles(apiClient, workspaceId)
      .then((result) => {
        if (!cancelled) setFiles(result.files);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const patchModule = (mi: number, patch: Partial<DraftModule>) => setModules((prev) => prev.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  const patchLesson = (mi: number, li: number, patch: Partial<DraftLesson>) =>
    setModules((prev) => prev.map((m, i) => (i === mi ? { ...m, lessons: m.lessons.map((l, j) => (j === li ? { ...l, ...patch } : l)) } : m)));

  async function save() {
    setBusy(true);
    setError(null);
    const payload: ModuleInput[] = modules.map((m) => ({
      id: m.id,
      title: m.title.trim(),
      lessons: m.lessons.map(({ key: _key, ...l }) => ({
        ...l,
        title: l.title.trim(),
        videoUrl: l.kind === "video" ? (l.videoUrl ?? "").trim() || null : null,
        body: (l.body ?? "").trim() || null,
        fileId: l.kind === "file" ? l.fileId || null : null,
      })),
    }));
    try {
      const saved = await coursesSaveOutline(apiClient, workspaceId, course.id, payload);
      setModules(toDraft(saved));
      onSaved(saved);
      toast.success(t.outlineSaved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const incomplete = modules.some((m) => !m.title.trim() || m.lessons.some((l) => !l.title.trim()));
  const iconButton = "min-h-9";

  return (
    <div className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}
      {modules.length === 0 && <p className="text-sm text-ink-soft">{t.noModules}</p>}
      {modules.map((module, mi) => (
        <Card key={module.key} className="gap-0 p-4">
          <div className="flex items-end gap-2">
            <TextField className="min-w-0 flex-1" label={t.moduleTitle} required value={module.title} onChange={(e) => patchModule(mi, { title: e.target.value })} maxLength={200} />
            <Button type="button" variant="outline" className={iconButton} aria-label={t.moveUp} disabled={mi === 0} onClick={() => setModules((prev) => move(prev, mi, -1))}>
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button type="button" variant="outline" className={iconButton} aria-label={t.moveDown} disabled={mi === modules.length - 1} onClick={() => setModules((prev) => move(prev, mi, 1))}>
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button type="button" variant="outline" className={iconButton} aria-label={t.remove} onClick={() => setModules((prev) => prev.filter((_, i) => i !== mi))}>
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>

          <ul className="mt-4 space-y-3">
            {module.lessons.map((lesson, li) => (
              <li key={lesson.key} className="rounded-[0.5rem] border border-line bg-paper p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <TextField label={t.lessonTitle} required value={lesson.title} onChange={(e) => patchLesson(mi, li, { title: e.target.value })} maxLength={200} />
                  <Field label={t.kind}>
                    {(props) => (
                      <Select {...props} value={lesson.kind} onChange={(e) => patchLesson(mi, li, { kind: e.target.value as LessonKind })}>
                        <option value="video">{t.kind_video}</option>
                        <option value="text">{t.kind_text}</option>
                        <option value="file">{t.kind_file}</option>
                      </Select>
                    )}
                  </Field>
                </div>
                <div className="mt-3 space-y-3">
                  {lesson.kind === "video" && (
                    <TextField label={t.videoUrl} hint={t.videoHint} type="url" dir="ltr" value={lesson.videoUrl ?? ""} onChange={(e) => patchLesson(mi, li, { videoUrl: e.target.value })} maxLength={1000} />
                  )}
                  {lesson.kind === "file" && (
                    <Field label={t.file}>
                      {(props) => (
                        <Select {...props} value={lesson.fileId ?? ""} onChange={(e) => patchLesson(mi, li, { fileId: e.target.value || null })}>
                          <option value="">{t.chooseFile}</option>
                          {files.map((file) => (
                            <option key={file.id} value={file.id}>
                              {file.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  )}
                  {lesson.kind !== "file" && (
                    <Field label={t.body}>
                      {(props) => <Textarea {...props} rows={lesson.kind === "text" ? 5 : 2} value={lesson.body ?? ""} onChange={(e) => patchLesson(mi, li, { body: e.target.value })} />}
                    </Field>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label={t.duration}
                      type="number"
                      min={0}
                      value={lesson.durationSeconds ? String(Math.round(lesson.durationSeconds / 60)) : ""}
                      onChange={(e) => patchLesson(mi, li, { durationSeconds: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value) * 60)) })}
                    />
                    <TextField
                      label={t.dripDays}
                      hint={t.dripHint}
                      type="number"
                      min={0}
                      value={String(lesson.dripDays ?? 0)}
                      onChange={(e) => patchLesson(mi, li, { dripDays: Math.max(0, Math.floor(Number(e.target.value)) || 0) })}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" checked={Boolean(lesson.isFreePreview)} onChange={(e) => patchLesson(mi, li, { isFreePreview: e.target.checked })} />
                      {t.freePreview}
                    </label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" aria-label={t.moveUp} disabled={li === 0} onClick={() => patchModule(mi, { lessons: move(module.lessons, li, -1) })}>
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button type="button" variant="outline" size="sm" aria-label={t.moveDown} disabled={li === module.lessons.length - 1} onClick={() => patchModule(mi, { lessons: move(module.lessons, li, 1) })}>
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                      <Button type="button" variant="outline" size="sm" aria-label={t.remove} onClick={() => patchModule(mi, { lessons: module.lessons.filter((_, j) => j !== li) })}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => patchModule(mi, { lessons: [...module.lessons, { key: newKey(), title: "", kind: "video", videoUrl: "", body: "", fileId: null, isFreePreview: false, dripDays: 0 }] })}
            >
              <Plus className="size-4" aria-hidden />
              {t.addLesson}
            </Button>
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => setModules((prev) => [...prev, { key: newKey(), title: "", lessons: [] }])}>
          <Plus className="size-4" aria-hidden />
          {t.addModule}
        </Button>
        <Button onClick={() => void save()} disabled={busy || incomplete}>
          {busy ? common.saving : t.saveOutline}
        </Button>
      </div>
    </div>
  );
}

function SettingsTab({ course, onSaved, onDeleted }: { course: Course; onSaved: (course: Course) => void; onDeleted: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [form, setForm] = useState({ title: course.title, description: course.description ?? "", coverUrl: course.coverUrl ?? "", productId: course.productId ?? "" });
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .listProducts(workspaceId, { limit: 200 })
      .then((result) => {
        if (!cancelled) setProducts(result.products);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function update(patch: Parameters<typeof coursesUpdate>[3], done: string) {
    setBusy(true);
    setError(null);
    try {
      const saved = await coursesUpdate(apiClient, workspaceId, course.id, patch);
      onSaved(saved);
      toast.success(done);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "COURSE_EMPTY" ? t.courseEmpty : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void update({ title: form.title.trim(), description: form.description.trim() || null, coverUrl: form.coverUrl.trim() || null, productId: form.productId || null }, t.settingsSaved);
  }

  const link = `${STOREFRONT_URL}/store/${workspaceId}/learn/${course.slug}`;

  return (
    <div className="space-y-4">
      <Card className="gap-0 p-4">
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <TextField label={t.name} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
          <Field label={t.courseDescription}>
            {(props) => <Textarea {...props} rows={3} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
          </Field>
          <TextField label={t.cover} type="url" dir="ltr" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} maxLength={1000} />
          <Field label={t.product} hint={t.productHint}>
            {(props) => (
              <Select {...props} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">{t.noProduct}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !form.title.trim()}>
              {busy ? common.saving : common.save}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="flex-row flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{t.studentLink}</p>
          <p dir="ltr" className="truncate text-start text-xs text-ink-soft">
            {link}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={link} label={t.copy} />
          {course.status === "published" ? (
            <Button variant="outline" disabled={busy} onClick={() => void update({ status: "draft" }, t.settingsSaved)}>
              {t.unpublish}
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void update({ status: "published" }, t.settingsSaved)}>
              {t.publish}
            </Button>
          )}
        </div>
      </Card>

      <div>
        <Button variant="outline" onClick={() => setDeleting(true)}>
          <Trash2 className="size-4" aria-hidden />
          {t.delete}
        </Button>
      </div>
      <ConfirmDialog
        open={deleting}
        title={fmt(t.deleteTitle, { name: course.title })}
        description={t.deleteDescription}
        confirmLabel={common.delete}
        busyLabel={t.deleting}
        cancelLabel={common.cancel}
        destructive
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await coursesDelete(apiClient, workspaceId, course.id);
          } catch (err) {
            throw new Error(err instanceof ApiError && err.code === "COURSE_HAS_STUDENTS" ? t.hasStudents : errorMessage(err));
          }
          setDeleting(false);
          onDeleted();
        }}
      />
    </div>
  );
}

function StudentsTab({ courseId }: { courseId: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => coursesStudents(apiClient, workspaceId, courseId), [workspaceId, courseId]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const data: CourseStudents | null = list.data;

  async function enroll(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      list.setData(await coursesEnroll(apiClient, workspaceId, courseId, { phone: phone.trim(), fullName: name.trim() || undefined }));
      setPhone("");
      setName("");
    } catch (err) {
      toast.error(err instanceof ApiError && err.code === "INVALID_PHONE" ? t.invalidPhone : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function setRevoked(enrollmentId: string, revoked: boolean) {
    try {
      list.setData(await coursesSetEnrollmentRevoked(apiClient, workspaceId, enrollmentId, revoked));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <Card className="gap-0 p-4">
        <h3 className="text-sm font-semibold text-ink">{t.enrollTitle}</h3>
        <form onSubmit={enroll} className="mt-3 flex flex-wrap items-end gap-3">
          <TextField className="min-w-40 flex-1" label={t.phone} required type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} />
          <TextField className="min-w-40 flex-1" label={t.studentName} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          <Button type="submit" disabled={busy || !phone.trim()}>
            {t.enroll}
          </Button>
        </form>
      </Card>

      <DataState skeleton={<ListSkeleton />} loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {data && data.students.length === 0 ? (
          <EmptyState title={t.noStudents} />
        ) : (
          <Card className="gap-0 p-0">
            <ul className="divide-y divide-line">
              {(data?.students ?? []).map((student) => (
                <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      <bdi>{student.name || student.phone}</bdi>
                    </p>
                    <p className="text-xs text-ink-soft">
                      <bdi dir="ltr">{student.phone}</bdi> · {t[`source_${student.source}`]} · {formatDate(student.enrolledAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {student.revokedAt ? (
                      <StatusBadge value="revoked" tone="danger" text={t.revoked} />
                    ) : (
                      <span className="tabular-nums text-sm text-ink-soft">{fmt(t.progress, { done: student.completedLessons, total: data?.lessonsCount ?? 0 })}</span>
                    )}
                    <Button size="sm" variant="outline" onClick={() => void setRevoked(student.id, !student.revokedAt)}>
                      {student.revokedAt ? t.restore : t.revoke}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </DataState>
    </div>
  );
}
