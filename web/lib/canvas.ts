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
// Note: Canvas's /courses?enrollment_type=X param takes a SINGLE role, so a TA
// would be excluded by enrollment_type=teacher. We instead derive the list of
// taught courses from the enrollments call (which already filters Teacher+TA)
// and look up each course's name individually.
export async function getTaughtCourses(
  baseUrl: string,
  token: string,
): Promise<TaughtCourse[]> {
  const enrollments: CanvasEnrollment[] = await canvasGet(
    baseUrl,
    token,
    "/users/self/enrollments?type[]=TeacherEnrollment&type[]=TaEnrollment&state[]=active&per_page=100",
  );
  const taughtIds = Array.from(
    new Set(enrollments.map((e) => e.course_id).filter(Boolean)),
  );
  if (taughtIds.length === 0) return [];

  const results: TaughtCourse[] = [];
  for (const id of taughtIds) {
    try {
      const course = (await canvasGet(baseUrl, token, `/courses/${id}`)) as {
        id?: number;
        name?: string;
      };
      if (course?.id && course.name) {
        results.push({ id: course.id, name: course.name });
      }
    } catch {
      // skip courses we can't fetch individually (e.g. unpublished/restricted)
    }
  }
  return results;
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
