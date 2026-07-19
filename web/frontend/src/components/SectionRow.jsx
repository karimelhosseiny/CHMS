export default function SectionRow({ section, course, onRegister, disabled }) {
  const seatsAvailable = section.capacity - section.roster.length;
  const isFull = seatsAvailable <= 0;
  const meets = section.meetingTimes.map((t) => `${t.day} ${t.start}-${t.end}`).join(', ');

  return (
    <tr>
      <td>{section.sectionId}</td>
      <td>{course ? course.title : section.courseCode}</td>
      <td>{course ? course.creditHours : '-'}</td>
      <td>{meets}</td>
      <td>{section.instructor}</td>
      <td>{section.room}</td>
      <td>
        {isFull ? (
          <span className="badge badge-warning">Full ({section.waitlist.length} waitlisted)</span>
        ) : (
          <span className="badge badge-ok">{seatsAvailable} seat(s)</span>
        )}
      </td>
      <td>
        <button type="button" disabled={disabled} onClick={() => onRegister(section, true)}>
          {isFull ? 'Join Waitlist' : 'Register'}
        </button>
      </td>
    </tr>
  );
}
