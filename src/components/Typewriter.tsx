import { useEffect, useState } from "react";

export function Typewriter({
  lines,
  speed,
  resetKey,
}: {
  lines: string[];
  speed: number;
  resetKey: string;
}) {
  const full = lines.join("\n\n");
  const [n, setN] = useState(full.length);

  useEffect(() => {
    if (speed <= 0) {
      setN(full.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 2;
      setN(Math.min(full.length, i));
      if (i >= full.length) window.clearInterval(id);
    }, Math.max(8, 40 - speed));
    return () => window.clearInterval(id);
  }, [resetKey, full, speed]);

  return (
    <div className="type">
      {full.slice(0, n).split("\n\n").map((p, idx) => (
        <p key={idx}>{p}</p>
      ))}
    </div>
  );
}
