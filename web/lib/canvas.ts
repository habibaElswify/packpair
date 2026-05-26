// Canvas LMS REST API helpers (server-side only — uses the user's token).
// Default base URL is UW's Canvas. The user's token can read THEIR enrollments
// (teacher verification) and, for courses they teach, the student roster.

export const DEFAULT_CANVAS_BASE = "https://canvas.uw.edu";

type CanvasEnrollment = {
  type: string; // StudentEnrollment | TeacherEnrollment | TaEnrollment | ...
  course_id: number;
};

export type TaughtCourse = { id: number; name: string };

async function canvasGet(baseUrl: string, token: string, path: string) {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Canvas rejected the token (401)");
  if (res.status === 403) throw new Error("Not permitted (403) — are you the teacher of that course?");
  if (!res.ok) throw new Error(`Canvas API error ${res.status}`);
  return res.json();
}

// Courses where the signed-in user is a Teacher or TA. Doubles as the teacher
// verification: an empty list means they can't create real events for a course.
export async function getTaughtCourses(
  baseUrl: string,
  token: string,
): Promise<TaughtCourse[]> {
  const enrollments: CanvasEnrollment[] = await canvasGet(
    baseUrl,
    token,
    "/users/self/enrollments?type[]=TeacherEnrollment&type[]=TaEnrollment&per_page=100",
  );
  const teaches = new Set(enrollments.map((e) => e.course_id));
  if (teaches.size === 0) return [];
  const courses: { id: number; name: string }[] = await canvasGet(
    baseUrl,
    token,
    "/courses?enrollment_type=teacher&per_page=100",
  );
  return courses
    .filter((c) => teaches.has(c.id) && c.name)
    .map((c) => ({ id: c.id, name: c.name }));
}

export type RosterEntry = { name: string; email: string };

// Student roster for a course the user teaches.
export async function getCourseRoster(
  baseUrl: string,
  token: string,
  courseId: string | number,
): Promise<RosterEntry[]> {
  const users: { id: number; name?: string; email?: string; login_id?: string }[] =
    await canvasGet(
      baseUrl,
      token,
      `/courses/${courseId}/users?enrollment_type[]=student&per_page=100`,
    );
  return users.map((u) => ({
    name: u.name ?? `Student ${u.id}`,
    email: u.email ?? u.login_id ?? `canvas-${u.id}@import.packpair`,
  }));
}
