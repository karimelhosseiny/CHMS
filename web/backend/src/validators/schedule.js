function timeSlotsOverlap(a, b) {
  if (a.day !== b.day) return false;
  return a.start < b.end && b.start < a.end;
}

function sectionsConflict(sectionA, sectionB) {
  return sectionA.meetingTimes.some((a) => sectionB.meetingTimes.some((b) => timeSlotsOverlap(a, b)));
}

module.exports = { timeSlotsOverlap, sectionsConflict };
