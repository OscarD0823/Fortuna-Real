import { useEffect, useState } from "react";
import { Crown } from "lucide-react";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 2700);
    const doneTimer = window.setTimeout(onDone, 3350);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  const skip = () => {
    setLeaving(true);
    window.setTimeout(onDone, 520);
  };

  return (
    <div className={`splash ${leaving ? "splash--leaving" : ""}`} role="dialog" aria-label="Iniciando Fortuna Real">
      <div className="splash-stars" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
      </div>
      <div className="splash-orbit splash-orbit--outer" aria-hidden="true" />
      <div className="splash-orbit splash-orbit--inner" aria-hidden="true" />
      <div className="splash-content">
        <div className="splash-emblem" aria-hidden="true">
          <div className="splash-wheel">
            {Array.from({ length: 12 }, (_, index) => (
              <span key={index} style={{ transform: `rotate(${index * 30}deg)` }} />
            ))}
            <div><Crown size={42} strokeWidth={1.25} /></div>
          </div>
        </div>
        <div className="splash-title" aria-label="Fortuna Real">
          <span>FORTUNA</span> <strong>REAL</strong>
        </div>
        <p>Sorteos con emoción real</p>
        <div className="splash-loader"><i /></div>
      </div>
      <button type="button" className="splash-skip" onClick={skip}>Saltar intro</button>
    </div>
  );
}
