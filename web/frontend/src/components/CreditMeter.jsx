export default function CreditMeter({ activeCreditHours, maxAllowedCredits, minRequired = 12 }) {
  const percent = Math.min(100, Math.round((activeCreditHours / maxAllowedCredits) * 100));
  const belowMin = activeCreditHours < minRequired;

  return (
    <div className="credit-meter">
      <div className="credit-meter-header">
        <span>Active credits: {activeCreditHours} / {maxAllowedCredits}</span>
        {belowMin && <span className="badge badge-warning">Below {minRequired}-credit minimum</span>}
      </div>
      <div className="credit-meter-bar">
        <div className="credit-meter-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
