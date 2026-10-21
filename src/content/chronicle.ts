import type { GameState, LocationId, TimeOfDay } from "../types";
import { CLASSES } from "./classes";
import { FEARS, MARKS, TEMPERS, they, driveVerb } from "./identity";
import { ORIGINS } from "./origins";
import { LOCATIONS } from "./world";

const SKY: Record<TimeOfDay, string[]> = {
  dawn: [
    "The sky is a wound deciding whether to heal.",
    "First light arrives like it is not sure it is welcome.",
    "Dawn peels the night off the rooftops in thin gold strips.",
  ],
  day: [
    "Daylight here is a borrowed coat: it fits, it is not yours.",
    "The sun does its work without conviction.",
    "Noon stands over the road and pretends not to see the cracks.",
  ],
  dusk: [
    "Dusk is the hour the Veil likes best. It is a gossip.",
    "Lamps wake. The dark between them is already organized.",
    "Evening comes down the lane like a tax collector.",
  ],
  night: [
    "Night does not fall. It is admitted.",
    "Stars look like pinholes in something that is listening.",
    "The dark has elbows. You feel them when you turn.",
  ],
};

const LOCAL_COLOR: Record<LocationId, string[]> = {
  emberhearth: [
    "Woodsmoke writes the same sentence it has written for a hundred winters.",
    "Someone is baking. Someone else is praying. They use similar hands.",
    "The inn sign creaks in a dialect older than the village.",
  ],
  veilwood: [
    "Leaves turn to watch you, then remember they are not supposed to.",
    "The path is generous for three steps and a miser on the fourth.",
    "You smell sap and old names.",
  ],
  saltmoor: [
    "Ropes tick against masts like impatient fingers.",
    "The water is the color of a bruise that learned to swim.",
    "Fog comes in with opinions.",
  ],
  archives: [
    "Dust here is literate. It settles in the shapes of letters.",
    "Aisle lamps burn with the patience of clerks.",
    "Somewhere a catalog is correcting itself.",
  ],
  cathedral: [
    "Ash takes footprints and keeps them as relics.",
    "Stained glass still throws colors. The colors are tired.",
    "The nave is a throat. It has not finished swallowing.",
  ],
  rift: [
    "The horizon is a torn page. You can see the next chapter's bones.",
    "Gravity has moods. Stay on its good side.",
    "Your memories arrive slightly before you do.",
  ],
};

export function pickLine(list: string[], rng: number): string {
  if (list.length === 0) return "";
  return list[Math.abs(rng) % list.length]!;
}

export function atmosphere(state: GameState): string {
  if (!state.world) return "";
  const { time, locationId, rng, day } = state.world;
  const a = pickLine(SKY[time], rng);
  const b = pickLine(LOCAL_COLOR[locationId], rng >> 3);
  return `${a} ${b} It is day ${day} of your becoming.`;
}

export function chroniclerAside(state: GameState): string | undefined {
  if (!state.world || state.world.memories.length < 2) return undefined;
  if (state.world.day < 2) return undefined;
  const mem = state.world.memories[state.world.memories.length - 1];
  const asides = [
    `The Chronicler notes, uninvited: "${mem}"`,
    `A quill scratches in a place with no desk: remember this — ${mem.toLowerCase()}`,
    `You have the sense of being read. The last line it liked was: ${mem}`,
  ];
  return pickLine(asides, state.world.rng + state.world.day * 17);
}

export function classVoice(state: GameState, line: string): string {
  const temper = state.player?.identity.temper;
  if (temper) return `${line} ${TEMPERS[temper].voice}`;
  const id = state.player?.classId;
  if (id === "hexweaver") return `${line} The words of it settle under your tongue like a coin.`;
  if (id === "warden") return `${line} Your shoulders take the information as a load they can carry.`;
  if (id === "ashblade") return `${line} Part of you has already measured the exits.`;
  if (id === "oathbound") return `${line} You set it against the vow and wait to see if they rhyme.`;
  return line;
}

export function originWake(state: GameState): string {
  if (!state.player) return "You wake.";
  const p = state.player;
  const who = they(p.identity);
  const mark = MARKS[p.identity.mark].wake;
  return `${ORIGINS[p.originId].opening} ${mark} The Chronicler tries the sentence "${p.name}, ${who.they} who would ${driveVerb(p.identity.drive)}" and does not cross it out.`;
}

export function fearPressure(state: GameState): string | undefined {
  const p = state.player;
  const loc = state.world?.locationId;
  if (!p || !loc) return undefined;
  const fear = FEARS[p.identity.fear];
  if (fear.place !== loc) return undefined;
  return `Your fear of ${fear.name.toLowerCase()} sits up in the chest like a second tenant.`;
}

export function identityContext(state: GameState): string {
  const p = state.player;
  if (!p) return "";
  return `${p.name} (${they(p.identity).they}/${they(p.identity).them}), ${p.identity.epithet}, ${CLASSES[p.classId].name}, ${ORIGINS[p.originId].name}, virtue ${p.identity.virtue}, vice ${p.identity.vice}.`;
}

export function placeName(id: LocationId): string {
  return LOCATIONS[id].name;
}

export async function rewriteWithModel(
  sceneBody: string[],
  context: string,
  settings: GameState["settings"],
): Promise<string[] | null> {
  if (!settings.aiEnabled || !settings.apiKey) return null;
  const base = settings.apiBase.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.8,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You are the Chronicler, narrator of the dark-fantasy RPG Aetherbound. Rewrite the scene in 2-4 short literary paragraphs. Keep all facts, names, and outcomes identical. No game mechanics. No markdown.",
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nScene:\n${sceneBody.join("\n\n")}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}
