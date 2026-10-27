"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  learnCourse,
  learnDownloadLessonFile,
  learnLesson,
  learnMyCourses,
  learnRequestCode,
  learnSetCompleted,
  learnVerify,
  type StudentCourse,
  type StudentCourseOutline,
  type StudentLesson,
  type StudentLessonRow,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { StoreLink } from "./StoreRoute";
import { btnPrimary, btnSecondary, card, container, input, label } from "./ui";
import { StoreLoader } from "@/components/StoreLoader";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

const STRINGS = {
  en: {
    myCourses: "My courses",
    intro: "Sign in with the phone number you ordered with.",
    phone: "Phone number",
    sendCode: "Send me a code",
    sending: "Sending…",
    codeSent: "If this number has a course, a code is on its way by SMS.",
    code: "Code",
    signIn: "Sign in",
    signingIn: "Signing in…",
    changePhone: "Use another number",
    signOut: "Sign out",
    invalidPhone: "Enter a valid phone number.",
    invalidCode: "That code is not valid.",
    expiredCode: "That code has expired. Ask for a new one.",
    tooMany: "Too many attempts. Try again in a few minutes.",
    error: "Something went wrong. Please try again.",
    noCourses: "You have no courses yet.",
    progress: (done: number, total: number) => `${done} of ${total} lessons done`,
    open: "Open",
    loading: "Loading…",
    notFound: "This course is not available.",
    free: "Free preview",
    locked: "Buy the course to open this lesson",
    availableOn: (when: string) => `Opens on ${when}`,
    buy: "Get the course",
    haveIt: "Already bought it? Sign in",
    choose: "Choose a lesson to start.",
    done: "Mark as done",
    undone: "Done — undo",
    download: "Download",
    downloading: "Downloading…",
    minutes: (n: number) => `${n} min`,
    back: "My courses",
  },
  ar: {
    myCourses: "كورساتي",
    intro: "ادخل برقم الموبايل اللي طلبت بيه.",
    phone: "رقم الموبايل",
    sendCode: "ابعتلي كود",
    sending: "جارٍ الإرسال…",
    codeSent: "لو الرقم ده عليه كورس، هيوصلك كود في رسالة.",
    code: "الكود",
    signIn: "دخول",
    signingIn: "جارٍ الدخول…",
    changePhone: "استخدم رقم تاني",
    signOut: "خروج",
    invalidPhone: "اكتب رقم موبايل صحيح.",
    invalidCode: "الكود ده مش صحيح.",
    expiredCode: "الكود انتهت صلاحيته. اطلب كود جديد.",
    tooMany: "محاولات كتير. جرّب تاني بعد شوية.",
    error: "حصلت مشكلة. حاول تاني.",
    noCourses: "لسه معندكش كورسات.",
    progress: (done: number, total: number) => `خلصت ${done} من ${total} درس`,
    open: "افتح",
    loading: "جارٍ التحميل…",
    notFound: "الكورس ده مش متاح.",
    free: "معاينة مجانية",
    locked: "اشترِ الكورس عشان تفتح الدرس ده",
    availableOn: (when: string) => `هيتفتح يوم ${when}`,
    buy: "اشترك في الكورس",
    haveIt: "اشتريته قبل كده؟ ادخل",
    choose: "اختار درس عشان تبدأ.",
    done: "علّم إنه خلص",
    undone: "خلص — تراجع",
    download: "تحميل",
    downloading: "جارٍ التحميل…",
    minutes: (n: number) => `${n} د`,
    back: "كورساتي",
  },
};

type T = (typeof STRINGS)["en"];
const tokenKey = (workspaceId: string) => `zimos.student.${workspaceId}`;

/** The student's token for this store, kept for this browser (courses are followed over weeks). */
function useStudentToken(workspaceId: string) {
  const [token, setTokenState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setTokenState(localStorage.getItem(tokenKey(workspaceId)));
    } catch {
      /* storage blocked — sign in each visit */
    }
    setReady(true);
  }, [workspaceId]);
  const setToken = useCallback(
    (next: string | null) => {
      setTokenState(next);
      try {
        if (next) localStorage.setItem(tokenKey(workspaceId), next);
        else localStorage.removeItem(tokenKey(workspaceId));
      } catch {
        /* this visit only */
      }
    },
    [workspaceId]
  );
  return { token, setToken, ready };
}

function problemText(t: T, err: unknown): string {
  const code = err instanceof ApiError ? err.code : undefined;
  if (code === "INVALID_PHONE") return t.invalidPhone;
  if (code === "INVALID_CODE") return t.invalidCode;
  if (code === "EXPIRED") return t.expiredCode;
  if (code === "TOO_MANY_ATTEMPTS" || code === "OTP_RATE_LIMITED" || code === "RATE_LIMITED") return t.tooMany;
  return t.error;
}

function SignIn({ workspaceId, t, onToken }: { workspaceId: string; t: T; onToken: (token: string) => void }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const client = createStorefrontApiClient();
      if (step === "phone") {
        await learnRequestCode(client, workspaceId, phone.trim());
        setStep("code");
      } else {
        onToken((await learnVerify(client, workspaceId, phone.trim(), code.trim())).token);
      }
    } catch (err) {
      setError(problemText(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${card} mx-auto max-w-md p-6`}>
      <h1 className="text-xl font-semibold text-ink">{t.myCourses}</h1>
      <p className="mt-1 text-sm text-ink-soft">{step === "phone" ? t.intro : t.codeSent}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="mt-4 space-y-4">
        {step === "phone" ? (
          <div>
            <label className={label} htmlFor="student-phone">
              {t.phone}
            </label>
            <input id="student-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required maxLength={32} className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        ) : (
          <div>
            <label className={label} htmlFor="student-code">
              {t.code}
            </label>
            <input id="student-code" type="text" inputMode="numeric" autoComplete="one-time-code" dir="ltr" required maxLength={10} className={input} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        )}
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {step === "phone" ? (busy ? t.sending : t.sendCode) : busy ? t.signingIn : t.signIn}
        </button>
        {step === "code" && (
          <button type="button" className="w-full cursor-pointer text-sm text-primary" onClick={() => setStep("phone")}>
            {t.changePhone}
          </button>
        )}
      </form>
    </div>
  );
}

/** /learn — sign in, then the student's courses. */
export function LearnHome({ workspaceId }: { workspaceId: string }) {
  const { intlLocale } = useStore();
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;
  const { token, setToken, ready } = useStudentToken(workspaceId);
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);

  useEffect(() => {
    if (!token) {
      setCourses(null);
      return;
    }
    let cancelled = false;
    learnMyCourses(createStorefrontApiClient(), workspaceId, token)
      .then((found) => {
        if (!cancelled) setCourses(found);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, workspaceId, setToken]);

  if (!ready) return null;
  if (!token) {
    return (
      <div className={`${container} py-10`}>
        <SignIn workspaceId={workspaceId} t={t} onToken={setToken} />
      </div>
    );
  }

  return (
    <div className={`${container} max-w-3xl space-y-5 py-10`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">{t.myCourses}</h1>
        <button type="button" className={btnSecondary} onClick={() => setToken(null)}>
          {t.signOut}
        </button>
      </div>
      {courses === null ? (
        <StoreLoader label={t.loading} />
      ) : courses.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.noCourses}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => {
            const percent = course.lessonsCount ? Math.round((100 * course.completedLessons) / course.lessonsCount) : 0;
            return (
              <li key={course.slug} className={`${card} overflow-hidden`}>
                {course.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={course.coverUrl} alt="" className="aspect-video w-full object-cover" />
                )}
                <div className="p-4">
                  <h2 dir="auto" className="text-base font-semibold text-ink">
                    {course.title}
                  </h2>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-label={t.progress(course.completedLessons, course.lessonsCount)}
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">{t.progress(course.completedLessons, course.lessonsCount)}</p>
                  <StoreLink href={`/learn/${course.slug}`} className={`${btnPrimary} mt-4 w-full`}>
                    {t.open}
                  </StoreLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Turns a watch link into the player's embed address for the hosts we know; anything else opens as a link. */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" && u.pathname === "/watch" && u.searchParams.get("v")) return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    if (host === "youtu.be" && u.pathname.length > 1) return `https://www.youtube.com/embed${u.pathname}`;
    if (host === "youtube.com" && u.pathname.startsWith("/embed/")) return url;
    if (host === "vimeo.com" && /^\/\d+/.test(u.pathname)) return `https://player.vimeo.com/video${u.pathname}`;
    if (host === "player.vimeo.com" || host === "iframe.mediadelivery.net") return url;
    return null;
  } catch {
    return null;
  }
}

/** /learn/<slug> — the course outline and the open lesson. */
export function LearnCourse({ workspaceId, slug }: { workspaceId: string; slug: string }) {
  const { intlLocale } = useStore();
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;
  const { token, setToken, ready } = useStudentToken(workspaceId);
  const [outline, setOutline] = useState<StudentCourseOutline | null>(null);
  const [missing, setMissing] = useState(false);
  const [current, setCurrent] = useState<StudentLessonRow | null>(null);
  const [lesson, setLesson] = useState<StudentLesson | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    learnCourse(createStorefrontApiClient(), workspaceId, slug, token)
      .then((found) => {
        if (!cancelled) setOutline(found);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 404) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, slug, token, ready, reload]);

  useEffect(() => {
    if (!current) {
      setLesson(null);
      return;
    }
    let cancelled = false;
    setLesson(null);
    learnLesson(createStorefrontApiClient(), workspaceId, slug, current.id, token)
      .then((found) => {
        if (!cancelled) setLesson(found);
      })
      .catch(() => {
        if (!cancelled) setCurrent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [current, workspaceId, slug, token]);

  async function toggleDone() {
    if (!current || !token) return;
    await learnSetCompleted(createStorefrontApiClient(), workspaceId, slug, current.id, token, !current.completed).catch(() => undefined);
    setCurrent({ ...current, completed: !current.completed });
    setReload((n) => n + 1);
  }

  async function download() {
    if (!current || !lesson?.fileName) return;
    setDownloading(true);
    try {
      const blob = await learnDownloadLessonFile(apiBaseUrl, workspaceId, slug, current.id, token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = lesson.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      /* the button stays; the student can try again */
    } finally {
      setDownloading(false);
    }
  }

  if (missing) {
    return (
      <div className={`${container} py-10`}>
        <p className="text-center text-sm text-ink-soft">{t.notFound}</p>
      </div>
    );
  }
  if (!outline) {
    return (
      <div className={`${container} py-10`}>
        <StoreLoader label={t.loading} className="mx-auto" />
      </div>
    );
  }
  if (signingIn && !token) {
    return (
      <div className={`${container} py-10`}>
        <SignIn
          workspaceId={workspaceId}
          t={t}
          onToken={(next) => {
            setToken(next);
            setSigningIn(false);
          }}
        />
      </div>
    );
  }

  const when = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" });
  const player = lesson?.kind === "video" && lesson.videoUrl ? embedUrl(lesson.videoUrl) : null;

  return (
    <div className={`${container} space-y-5 py-8`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {outline.enrolled && (
            <StoreLink href="/learn" className="text-sm text-ink-soft hover:text-primary">
              ← {t.back}
            </StoreLink>
          )}
          <h1 dir="auto" className="text-2xl font-semibold text-ink">
            {outline.course.title}
          </h1>
          {outline.course.description && (
            <p dir="auto" className="mt-1 max-w-2xl whitespace-pre-line text-sm text-ink-soft">
              {outline.course.description}
            </p>
          )}
        </div>
        {!outline.enrolled && (
          <div className="flex flex-wrap gap-2">
            {outline.product && (
              <StoreLink href={`/products/${outline.product.slug}`} className={btnPrimary}>
                {t.buy}
              </StoreLink>
            )}
            <button type="button" className={btnSecondary} onClick={() => setSigningIn(true)}>
              {t.haveIt}
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className={`${card} min-h-64 p-5`}>
          {!current ? (
            <p className="text-sm text-ink-soft">{t.choose}</p>
          ) : !lesson ? (
            <StoreLoader label={t.loading} />
          ) : (
            <div className="space-y-4">
              <h2 dir="auto" className="text-lg font-semibold text-ink">
                {lesson.title}
              </h2>
              {lesson.kind === "video" &&
                lesson.videoUrl &&
                (player ? (
                  <div className="aspect-video overflow-hidden rounded-xl bg-black">
                    <iframe src={player} title={lesson.title} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="size-full border-0" />
                  </div>
                ) : (
                  <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                    {t.open}
                  </a>
                ))}
              {lesson.body && (
                <p dir="auto" className="whitespace-pre-line text-sm leading-7 text-ink">
                  {lesson.body}
                </p>
              )}
              {lesson.kind === "file" && lesson.fileName && (
                <button type="button" disabled={downloading} className={btnPrimary} onClick={() => void download()}>
                  {downloading ? t.downloading : t.download} · <bdi>{lesson.fileName}</bdi>
                </button>
              )}
              {outline.enrolled && token && (
                <div>
                  <button type="button" className={btnSecondary} onClick={() => void toggleDone()}>
                    {current.completed ? t.undone : t.done}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <nav aria-label={outline.course.title} className="space-y-4">
          {outline.modules.map((module) => (
            <div key={module.id} className={`${card} p-3`}>
              <h3 dir="auto" className="px-2 pb-2 text-sm font-semibold text-ink">
                {module.title}
              </h3>
              <ul className="space-y-1">
                {module.lessons.map((row) => {
                  const active = current?.id === row.id;
                  const note = row.open
                    ? row.isFreePreview && !outline.enrolled
                      ? t.free
                      : null
                    : row.lockedReason === "not_released" && row.availableAt
                      ? t.availableOn(when.format(new Date(row.availableAt)))
                      : t.locked;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={!row.open}
                        aria-current={active ? "true" : undefined}
                        onClick={() => setCurrent(row)}
                        className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start text-sm ${
                          active ? "bg-primary-soft text-ink" : "text-ink hover:bg-paper"
                        } ${row.open ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                      >
                        <span aria-hidden className="mt-0.5 shrink-0">
                          {row.completed ? "✓" : row.open ? "▸" : "🔒"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span dir="auto" className="block">
                            {row.title}
                          </span>
                          <span className="block text-xs text-ink-soft">
                            {[row.durationSeconds ? t.minutes(Math.max(1, Math.round(row.durationSeconds / 60))) : null, note].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
