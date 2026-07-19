import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function ScheduleConsistencyReport() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const result = await api.adminScheduleConsistency();
      setReport(result);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <h1>Catalog Schedule Consistency</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <button type="button" onClick={load}>Re-run check</button>

      {report && (
        <div className="section-card">
          {report.consistent ? (
            <div className="alert alert-ok">No room or instructor double-bookings detected.</div>
          ) : (
            <>
              <div className="alert alert-error">{report.issues.length} scheduling issue(s) found.</div>
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Resource</th>
                    <th>Section A</th>
                    <th>Section B</th>
                  </tr>
                </thead>
                <tbody>
                  {report.issues.map((issue, idx) => (
                    <tr key={idx}>
                      <td>{issue.kind}</td>
                      <td>{issue.resource}</td>
                      <td>{issue.sectionA}</td>
                      <td>{issue.sectionB}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
