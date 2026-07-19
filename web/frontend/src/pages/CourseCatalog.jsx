import { useEffect, useState } from 'react';
import { api } from '../api/client';
import SectionRow from '../components/SectionRow';

export default function CourseCatalog() {
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busySectionId, setBusySectionId] = useState(null);

  const load = async () => {
    const [courseList, sectionList] = await Promise.all([api.listCourses(), api.listSections()]);
    setCourses(courseList);
    setSections(sectionList);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const courseByCode = Object.fromEntries(courses.map((c) => [c.code, c]));

  const handleRegister = async (section, allowWaitlist) => {
    setError(null);
    setMessage(null);
    setBusySectionId(section.sectionId);
    try {
      const enrollment = await api.enroll(section.sectionId, allowWaitlist);
      setMessage(
        enrollment.status === 'ENROLLED'
          ? `Enrolled in ${section.sectionId}.`
          : `Section ${section.sectionId} is full — added to the waitlist.`
      );
      await load();
    } catch (err) {
      setError(`${err.name}: ${err.message}`);
    } finally {
      setBusySectionId(null);
    }
  };

  return (
    <div className="page">
      <h1>Course Catalog</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-ok">{message}</div>}

      <table>
        <thead>
          <tr>
            <th>Section</th>
            <th>Course</th>
            <th>Credits</th>
            <th>Meets</th>
            <th>Instructor</th>
            <th>Room</th>
            <th>Seats</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <SectionRow
              key={s.sectionId}
              section={s}
              course={courseByCode[s.courseCode]}
              onRegister={handleRegister}
              disabled={busySectionId === s.sectionId}
            />
          ))}
        </tbody>
      </table>

      <div className="section-card">
        <h2>Course Prerequisites</h2>
        <ul>
          {courses.map((c) => (
            <li key={c.code}>
              <strong>{c.code}</strong> — {c.title} ({c.creditHours} cr)
              {c.prerequisites.length > 0 && <span> · Requires: {c.prerequisites.join(', ')}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
