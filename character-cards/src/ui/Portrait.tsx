function hueFor(name: string): number {
  return [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
}

export function Portrait({ src, name }: { src: string | null; name: string }) {
  if (src) return <img className="portrait" src={src} alt="" />;
  const letter = (name.trim()[0] || "?").toUpperCase();
  return (
    <div className="portrait fallback" style={{ background: `hsl(${hueFor(name)} 32% 24%)` }} aria-hidden>
      {letter}
    </div>
  );
}
