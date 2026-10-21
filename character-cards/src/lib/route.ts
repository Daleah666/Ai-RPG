export type Route =
  | { name: "library" }
  | { name: "sheet"; id: string }
  | { name: "edit"; id: string }
  | { name: "chat"; id: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\/+/, "");
  const [head, id = ""] = path.split("/");
  const decoded = decodeURIComponent(id);
  if (head === "card" && decoded) return { name: "sheet", id: decoded };
  if (head === "edit" && decoded) return { name: "edit", id: decoded };
  if (head === "new") return { name: "edit", id: "new" };
  if (head === "chat" && decoded) return { name: "chat", id: decoded };
  return { name: "library" };
}

export function hrefFor(route: Route): string {
  if (route.name === "library") return "#/";
  if (route.name === "edit" && route.id === "new") return "#/new";
  if (route.name === "edit") return `#/edit/${encodeURIComponent(route.id)}`;
  if (route.name === "sheet") return `#/card/${encodeURIComponent(route.id)}`;
  return `#/chat/${encodeURIComponent(route.id)}`;
}
