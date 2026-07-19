import { useEffect, useState } from 'react';
import { api } from '../api/client';

const emptyCourseForm = { code: '', title: '', creditHours: 3, prerequisites: '' };
const emptySectionForm = {
  sectionId: '',
  courseCode: '',
  term: 'Fall2026',
  capacity: 2,
  instructor: '',
  room: '',
  day: 'MON',
  start: '09:00',
  end: '10:15',
};

export default function AdminDashboard() {
  const [students, setStudents] = useState([]);
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const loadStudents = async () => {
    const list = await api.adminListStudents();
    setStudents(list);
  };

  useEffect(() => {
    loadStudents().catch((err) => setError(err.message));
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.adminCreateCourse({
        code: courseForm.code,
        title: courseForm.title,
        creditHours: Number(courseForm.creditHours),
        prerequisites: courseForm.prerequisites.split(',').map((p) => p.trim()).filter(Boolean),
      });
      setMessage(`Course ${courseForm.code} created.`);
      setCourseForm(emptyCourseForm);
    } catch (err) {
      setError(`${err.name}: ${err.message}`);
    }
  };

  const handleCreateSection = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.adminCreateSection({
        sectionId: sectionForm.sectionId,
        courseCode: sectionForm.courseCode,
        term: sectionForm.term,
        capacity: Number(sectionForm.capacity),
        instructor: sectionForm.instructor,
        room: sectionForm.room,
        meetingTimes: [{ day: sectionForm.day, start: sectionForm.start, end: sectionForm.end }],
      });
      setMessage(`Section ${sectionForm.sectionId} created.`);
      setSectionForm(emptySectionForm);
    } catch (err) {
      setError(`${err.name}: ${err.message}`);
    }
  };

  const handleUpdateStudent = async (studentId, patch) => {
    setError(null);
    setMessage(null);
    try {
      await api.adminUpdateStudent(studentId, patch);
      setMessage(`Updated ${studentId}.`);
      await loadStudents();
    } catch (err) {
      setError(`${err.name}: ${err.message}`);
    }
  };

  return (
    <div className="page">
      <h1>Admin Dashboard</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-ok">{message}</div>}

      <div className="section-card">
        <h2>Create Course</h2>
        <form className="inline-form" onSubmit={handleCreateCourse}>
          <input placeholder="Code (e.g. CS401)" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} required />
          <input placeholder="Title" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} required />
          <input type="number" min={1} placeholder="Credit hours" value={courseForm.creditHours} onChange={(e) => setCourseForm({ ...courseForm, creditHours: e.target.value })} required />
          <input placeholder="Prerequisites (comma-separated)" value={courseForm.prerequisites} onChange={(e) => setCourseForm({ ...courseForm, prerequisites: e.target.value })} />
          <button type="submit">Create Course</button>
        </form>
      </div>

      <div className="section-card">
        <h2>Create Section</h2>
        <form className="inline-form" onSubmit={handleCreateSection}>
          <input placeholder="Section ID (e.g. CS401-A)" value={sectionForm.sectionId} onChange={(e) => setSectionForm({ ...sectionForm, sectionId: e.target.value })} required />
          <input placeholder="Course code" value={sectionForm.courseCode} onChange={(e) => setSectionForm({ ...sectionForm, courseCode: e.target.value })} required />
          <input placeholder="Term" value={sectionForm.term} onChange={(e) => setSectionForm({ ...sectionForm, term: e.target.value })} required />
          <input type="number" min={1} placeholder="Capacity" value={sectionForm.capacity} onChange={(e) => setSectionForm({ ...sectionForm, capacity: e.target.value })} required />
          <input placeholder="Instructor" value={sectionForm.instructor} onChange={(e) => setSectionForm({ ...sectionForm, instructor: e.target.value })} required />
          <input placeholder="Room" value={sectionForm.room} onChange={(e) => setSectionForm({ ...sectionForm, room: e.target.value })} required />
          <select value={sectionForm.day} onChange={(e) => setSectionForm({ ...sectionForm, day: e.target.value })}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input type="time" value={sectionForm.start} onChange={(e) => setSectionForm({ ...sectionForm, start: e.target.value })} required />
          <input type="time" value={sectionForm.end} onChange={(e) => setSectionForm({ ...sectionForm, end: e.target.value })} required />
          <button type="submit">Create Section</button>
        </form>
      </div>

      <div className="section-card">
        <h2>Students</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Standing</th>
              <th>Overload approved</th>
              <th>Completed courses</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <StudentRow key={s.studentId} student={s} onUpdate={handleUpdateStudent} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentRow({ student, onUpdate }) {
  const [completedCourses, setCompletedCourses] = useState(student.completedCourses.join(', '));

  return (
    <tr>
      <td>{student.studentId}</td>
      <td>{student.name}</td>
      <td>
        <select
          value={student.standing}
          onChange={(e) => onUpdate(student.studentId, { standing: e.target.value })}
        >
          <option value="GOOD_STANDING">GOOD_STANDING</option>
          <option value="PROBATION">PROBATION</option>
        </select>
      </td>
      <td>
        <input
          type="checkbox"
          checked={student.overloadApproved}
          onChange={(e) => onUpdate(student.studentId, { overloadApproved: e.target.checked })}
        />
      </td>
      <td>
        <input value={completedCourses} onChange={(e) => setCompletedCourses(e.target.value)} />
        <button
          type="button"
          onClick={() => onUpdate(student.studentId, { completedCourses: completedCourses.split(',').map((c) => c.trim()).filter(Boolean) })}
        >
          Save
        </button>
      </td>
    </tr>
  );
}
