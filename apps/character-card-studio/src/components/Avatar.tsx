import { avatarColor, initials } from "../lib/files";

export function Avatar({ name, src, className = "" }: { name: string; src: string | null; className?: string }) {
  if (src) return <img className={`avatar ${className}`} src={src} alt={`${name} avatar`} />;
  return (
    <div className={`avatar placeholder ${className}`} style={{ background: avatarColor(name || "?") }} aria-hidden>
      {initials(name)}
    </div>
  );
}
