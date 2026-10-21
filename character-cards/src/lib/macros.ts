export function applyMacros(
  text: string,
  names: { char: string; user: string },
): string {
  return text
    .replaceAll("{{char}}", names.char)
    .replaceAll("{{user}}", names.user);
}
