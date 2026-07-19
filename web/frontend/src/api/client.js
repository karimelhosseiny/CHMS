const TOKEN_KEY = 'chms_token';
const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error((data && data.message) || res.statusText);
    error.name = (data && data.error) || 'Error';
    error.statusCode = res.status;
    throw error;
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  listCourses: () => request('/courses'),
  listSections: (courseCode) => request(`/sections${courseCode ? `?courseCode=${encodeURIComponent(courseCode)}` : ''}`),
  me: () => request('/students/me'),
  finalize: () => request('/students/me/finalize', { method: 'POST' }),
  enroll: (sectionId, allowWaitlist = true) => request('/enrollments', { method: 'POST', body: { sectionId, allowWaitlist } }),
  drop: (sectionId) => request(`/enrollments/${encodeURIComponent(sectionId)}`, { method: 'DELETE' }),
  adminCreateCourse: (payload) => request('/admin/courses', { method: 'POST', body: payload }),
  adminCreateSection: (payload) => request('/admin/sections', { method: 'POST', body: payload }),
  adminScheduleConsistency: () => request('/admin/schedule-consistency'),
  adminListStudents: () => request('/admin/students'),
  adminUpdateStudent: (studentId, payload) => request(`/admin/students/${encodeURIComponent(studentId)}`, { method: 'PATCH', body: payload }),
};

export { getToken, setToken };
