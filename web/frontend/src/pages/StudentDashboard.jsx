import { useEffect, useState } from 'react';
import { api } from '../api/client';
import CreditMeter from '../components/CreditMeter';

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.me();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDrop = async (sectionId) => {
    setError(null);
    setMessage(null);
    try {
      await api.drop(sectionId);
      setMessage(`Dropped ${sectionId}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFinalize = async () => {
    setError(null);
    setMessage(null);
    try {
      const res = await api.finalize();
      setMessage(res.message);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="page">Loading...</div>;
  if (!data) return <div className="page">Unable to load your profile.</div>;

  const { student, enrollments, activeCreditHours, maxAllowedCredits } = data;

  return (
    <div className="page">
      <h1>Welcome, {student.name}</h1>
      <p>Student ID: {student.studentId} · Standing: {student.standing} {student.overloadApproved && '· Overload approved'}</p>

      <CreditMeter activeCreditHours={activeCreditHours} maxAllowedCredits={maxAllowedCredits} />

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-ok">{message}</div>}

      <div className="section-card">
        <h2>My Enrollments</h2>
        {enrollments.length === 0 && <p>No active enrollments or waitlist entries.</p>}
        {enrollments.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Course</th>
                <th>Credits</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.sectionId}>
                  <td>{e.sectionId}</td>
                  <td>{e.courseCode}</td>
                  <td>{e.creditHours}</td>
                  <td>
                    <span className={`badge ${e.status === 'ENROLLED' ? 'badge-ok' : 'badge-warning'}`}>{e.status}</span>
                  </td>
                  <td>
                    <button type="button" onClick={() => handleDrop(e.sectionId)}>Drop</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button type="button" onClick={handleFinalize}>Finalize Registration</button>
    </div>
  );
}
