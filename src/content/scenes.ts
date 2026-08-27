import type { Choice, GameState, Scene } from "../types";
import { beginCombat } from "../combat";
import {
  addGold,
  addItem,
  addXp,
  advanceTime,
  anchorsHeld,
  clone,
  flag,
  heal,
  hurt,
  itemCount,
  remember,
  requirePlay,
  setFlag,
  skillCheck,
  travel,
} from "../engine";
import { atmosphere, chroniclerAside, originWake, placeName } from "./chronicle";
import { ITEMS, SHOP } from "./items";
import { GRAPH, LOCATIONS } from "./world";

function gated(state: GameState, choice: Choice): boolean {
  if (choice.hideIfFlag && flag(state, choice.hideIfFlag)) return false;
  if (choice.showIfFlag && !flag(state, choice.showIfFlag)) return false;
  if (choice.requireFlag && !flag(state, choice.requireFlag)) return false;
  if (choice.requireItem && state.player && itemCount(state.player, choice.requireItem) < 1) {
    return false;
  }
  if (choice.requireGold && state.player && state.player.gold < choice.requireGold) {
    return false;
  }
  return true;
}

function visibleChoices(state: GameState, choices: Choice[]): Choice[] {
  return choices.filter((c) => gated(state, c));
}

function travelChoices(state: GameState): Choice[] {
  requirePlay(state);
  const dests = GRAPH[state.world.locationId] ?? [];
  return dests
    .filter((id) => id !== "rift" || anchorsHeld(state) >= 3)
    .map((id) => ({
      id: `travel.${id}`,
      label: `Travel to ${LOCATIONS[id].name}`,
      hint: LOCATIONS[id].travelHint,
      apply: (s) => {
        let next = travel(s, id);
        if (id === "rift") next = remember(next, "You walked into the unfinished part of the world.");
        return next;
      },
    }));
}

function dockChoices(state: GameState, extra: Choice[]): Choice[] {
  requirePlay(state);
  const rest: Choice[] = [];
  if (LOCATIONS[state.world.locationId].sanctuary) {
    rest.push({
      id: "rest.inn",
      label: "Take a room (8 gold, full rest)",
      hint: "Dawn, mended, and the inn's quiet lies.",
      requireGold: 8,
      apply: (s) => restInn(s),
    });
  } else {
    rest.push({
      id: "rest.camp",
      label: "Make a hard camp",
      hint: "Sleep is a rumor. You will take what you can.",
      apply: (s) => restCamp(s),
    });
  }
  return visibleChoices(state, [...extra, ...rest, ...travelChoices(state)]);
}

export function restInn(state: GameState): GameState {
  requirePlay(state);
  let next = clone(state);
  if (next.player.gold < 8) return next;
  next.player.gold -= 8;
  next.player.hp = next.player.hpMax;
  next.player.mp = next.player.mpMax;
  next.player.statuses = [];
  next.world.lastSanctuary = "emberhearth";
  next.world.time = "dawn";
  next.world.day += 1;
  next.event = null;
  next = remember(next, "You slept under a roof that still believed in mornings.");
  return next;
}

export function restCamp(state: GameState): GameState {
  requirePlay(state);
  let next = heal(state, Math.floor(state.player.hpMax * 0.4), Math.floor(state.player.mpMax * 0.4));
  next = advanceTime(next, 2);
  next.event = null;
  const roll = next.world.rng % 5;
  next.world.rng = (next.world.rng + 17) >>> 0;
  if (roll === 0 && next.world.locationId !== "rift") {
    const ambush =
      next.world.locationId === "saltmoor"
        ? "drowned_singer"
        : next.world.locationId === "cathedral"
          ? "cinder_acolyte"
          : next.world.locationId === "archives"
            ? "archive_shade"
            : "veilwolf";
    next = remember(next, "Camp was a mistake with teeth.");
    return beginCombat(next, ambush);
  }
  next = remember(next, "You slept like a stone that still had errands.");
  return next;
}

function scene(
  state: GameState,
  id: string,
  title: string,
  body: string[],
  choices: Choice[],
  kicker?: string,
): Scene {
  requirePlay(state);
  const aside = chroniclerAside(state);
  const text = aside ? [...body, aside] : body;
  return {
    id,
    title,
    kicker: kicker ?? atmosphere(state),
    body: text,
    locationId: state.world.locationId,
    choices: dockChoices(state, choices),
  };
}

function intro(state: GameState): Scene {
  requirePlay(state);
  const name = state.player.name;
  return {
    id: "intro.wake",
    title: "A Dream with Teeth",
    kicker: "The Veil is a curtain. Something is learning to open it.",
    locationId: "emberhearth",
    body: [
      originWake(state),
      `A voice that is not a voice writes your name — ${name} — on the inside of the dark. Three lights, far off, like nails holding a sky in place. Then one of the nails slips.`,
      "You sit up tasting copper and rain. Downstairs, Mira is arguing with a kettle. Outside, the Veilwood is closer than it was yesterday. You can tell because the birds have opinions about it.",
    ],
    choices: [
      {
        id: "intro.down",
        label: "Go downstairs",
        apply: (s) => setFlag(s, "intro.done"),
      },
    ],
  };
}

function emberhearth(state: GameState): Scene {
  requirePlay(state);
  if (state.event?.id === "shop") return shopScene(state, "Brann's Forge");
  if (state.event?.id === "wake.defeat") return defeatWake(state);

  if (!flag(state, "mira.met")) {
    return scene(
      state,
      "ember.mira.first",
      "The Hearth and the Lie",
      [
        "Mira looks at you the way a lighthouse looks at a storm: professionally fond, already grieving. She sets bread down hard enough to make a point.",
        `"The wood's walking closer," she says. "Pell saw a stag with a lantern where a heart should be. Kael from the watch went in and came out with someone else's memories. We are a village, not a hymn. We cannot do this."`,
        "She wipes her hands. \"Three Anchors, the old talk says. Ember, Tide, Ash. Hold the Veil shut. Or don't. I'm too old to tell a Bound what the dark is for.\"",
      ],
      [
        {
          id: "mira.accept",
          label: "Promise her you will find the Anchors",
          apply: (s) =>
            remember(setFlag(s, "mira.met"), "You promised Mira the sky would stay nailed up."),
        },
        {
          id: "mira.honest",
          label: "Tell her you don't know if you should",
          apply: (s) =>
            remember(
              setFlag(s, "mira.met"),
              "You refused to lie to Mira. She loved you more for the wound of it.",
            ),
        },
      ],
      "Emberhearth · Mira's inn",
    );
  }

  const missing = !flag(state, "side.liri.done")
    ? "A chair at the corner table is empty. Liri's, the flour-girl. Her ribbon is not on the peg."
    : "Liri is back at the corner table, drawing wolves that are trying to be kind.";

  return scene(
    state,
    "ember.hub",
    placeName("emberhearth"),
    [
      "The village holds itself together with routine and stubborn soup. Lamps are lit early. Dogs will not look north.",
      missing,
      flag(state, "anchor.ember")
        ? "People glance at your pack as if it were a church. The Ember Anchor ticks like a second heart."
        : "North, the Veilwood breathes. You can match it if you try.",
    ],
    [
      {
        id: "ember.mira",
        label: "Speak with Mira",
        apply: (s) => overlay(s, "talk.mira"),
      },
      {
        id: "ember.brann",
        label: "Visit Brann the smith",
        apply: (s) => overlay(s, "shop"),
      },
      {
        id: "ember.pell",
        label: "Listen to Old Pell",
        apply: (s) => overlay(s, "talk.pell"),
      },
      {
        id: "ember.liri",
        label: "Ask after Liri",
        hideIfFlag: "side.liri.done",
        apply: (s) => overlay(s, "talk.liri"),
      },
      {
        id: "ember.explore",
        label: "Walk the lanes",
        apply: (s) => exploreEmber(s),
      },
    ],
  );
}

function miraTalk(state: GameState): Scene {
  const n = anchorsHeld(state);
  const lines =
    n === 0
      ? `"Go north if you must. Kael left a mark on the Heart-Oak trail. If the stag bows, do not bow back."`
      : n < 3
        ? `"${n} of three. I am not a priest. I am a woman who counts cups. That is still a liturgy."`
        : `"You have them. Then the Rift will want a word. Eat first. Dying on an empty stomach is rude."`;
  return scene(
    state,
    "ember.mira.talk",
    "Mira",
    [
      "She pours. The tea is an opinion.",
      lines,
      state.player?.originId === "foundling"
        ? "For a moment she almost says mother-things. She swallows them. You both pretend not to notice."
        : "She treats you as a storm she has decided to board anyway.",
    ],
    [
      {
        id: "mira.back",
        label: "Leave her to the kettle",
        apply: clearEvent,
      },
    ],
  );
}

function pellTalk(state: GameState): Scene {
  return scene(
    state,
    "ember.pell",
    "Old Pell, Professionally Drowned",
    [
      "Pell has been drunk since a nicer decade. He points at you with a carrot he believes is a finger.",
      `"Stag in the wood, choir in the fog, saint in the ash. That's the shopping list. Also: don't trust bells. Bells are snitches."`,
      flag(state, "anchor.tide")
        ? `"You smell like a cancelled hymn. Good."`
        : `"Saltmoor still rings a fog bell for sailors who are not coming. Something else answers it now."`,
    ],
    [
      {
        id: "pell.buy",
        label: "Buy him a cup (2 gold) for a real rumor",
        requireGold: 2,
        apply: (s) =>
          remember(
            addGold(s, -2),
            "Pell sold you a rumor: the Archives catalog living things if you stand still too long.",
          ),
      },
      {
        id: "pell.back",
        label: "Step back into cleaner air",
        apply: clearEvent,
      },
    ],
  );
}

function liriStart(state: GameState): Scene {
  return scene(
    state,
    "ember.liri",
    "The Empty Peg",
    [
      "Mira's mouth goes thin. \"She went looking for wolf-flowers. I told her the wood doesn't make flowers anymore. It makes arguments.\"",
      "Brann saw a blue ribbon snagged on the north gate at dusk. The knot was the one children use when they are trying to be brave on purpose.",
    ],
    [
      {
        id: "liri.go",
        label: "Take the north path for her",
        apply: (s) => setFlag(travel(s, "veilwood"), "side.liri.started"),
      },
      {
        id: "liri.wait",
        label: "Not yet",
        apply: clearEvent,
      },
    ],
  );
}

function exploreEmber(state: GameState): GameState {
  requirePlay(state);
  const r = state.world.rng % 4;
  let next = clone(state);
  next.world.rng = (next.world.rng + 31) >>> 0;
  next = advanceTime(next, 1);
  if (r === 0) return beginCombat(next, "cutpurse");
  if (r === 1) return beginCombat(next, "ash_rat");
  if (r === 2) {
    next = addGold(next, 6);
    next = remember(next, "You found a coin under a saint-stone nobody prays at anymore.");
    next.event = { id: "ember.coin", step: 0 };
    return next;
  }
  next = addItem(next, "emberflask");
  next.event = { id: "ember.flask", step: 0 };
  return next;
}

function veilwood(state: GameState): Scene {
  requirePlay(state);
  if (state.event?.id === "side.liri.found") return liriFound(state);

  if (flag(state, "side.liri.started") && !flag(state, "side.liri.done")) {
    return scene(
      state,
      "veil.liri.search",
      "Wolf-flowers",
      [
        "The trees have the manners of old judges. You find the ribbon on a thorn that should not be that height.",
        "A small voice is trying not to be a small voice. Liri is in a hollow, holding a fist of pale blossoms that are, on closer look, teeth.",
        "Between you and her, a Veilwolf sits like a doorstop for something worse.",
      ],
      [
        {
          id: "liri.fight",
          label: "Put yourself in the wolf's way",
          apply: (s) => {
            const next = clone(s);
            next.event = { id: "side.liri.found", step: 0 };
            return beginCombat(next, "veilwolf");
          },
        },
        {
          id: "liri.sneak",
          label: "Ease her out (Cunning 12)",
          skill: { stat: "cunning", dc: 12 },
          apply: (s) => {
            let next = addItem(s, "liris_ribbon");
            next = setFlag(next, "side.liri.done");
            next = addXp(next, 20);
            next = remember(next, "You stole a child back from a story that wanted her.");
            return travel(next, "emberhearth");
          },
          onFail: (s) => beginCombat(s, "veilwolf"),
        },
      ],
    );
  }

  if (!flag(state, "anchor.ember")) {
    return scene(
      state,
      "veil.heart",
      "The Heart-Oak",
      [
        "Kael's mark is a Warden's notch, half clawed away. Beyond it the Heart-Oak opens like a chapel that grew up wrong.",
        "The Hollow Stag is already kneeling, which is worse than charging. Its lantern-heart writes your outline on the leaves.",
        "You understand, without being told, that this is the Ember Anchor: not a stone, a wound that learned to shine.",
      ],
      [
        {
          id: "stag.fight",
          label: "Challenge the Hollow Stag",
          apply: (s) => beginCombat(s, "hollow_stag"),
        },
        {
          id: "stag.speak",
          label: "Speak to the lantern (Presence 13)",
          skill: { stat: "presence", dc: 13 },
          apply: (s) => {
            let next = setFlag(s, "stag.spoke");
            next = heal(next, 0, 8);
            return remember(next, "The Stag told you its true name and then regretted the intimacy.");
          },
          onFail: (s) => hurt(s, 6),
        },
        {
          id: "veil.explore",
          label: "Hunt the tree-line",
          apply: (s) => beginCombat(advanceTime(s, 1), "veilwolf"),
        },
      ],
    );
  }

  return scene(
    state,
    "veil.after",
    "A Wood Without a King",
    [
      "The Heart-Oak is a standing grief. Birds have not decided if they are allowed to sit on it.",
      "West, the ground tilts toward the Archives. South-east, ash on the wind says cathedral. Behind you, Emberhearth pretends to be small.",
    ],
    [
      {
        id: "veil.explore2",
        label: "Walk the quiet paths",
        apply: (s) => {
          const r = s.world!.rng % 3;
          const next = advanceTime(s, 1);
          next.world!.rng = (next.world!.rng + 11) >>> 0;
          if (r === 0) return addItem(next, "aether_tea");
          if (r === 1) return addGold(next, 9);
          return beginCombat(next, "veilwolf");
        },
      },
    ],
  );
}

function liriFound(state: GameState): Scene {
  return scene(
    state,
    "veil.liri.saved",
    "A Fist of Wrong Flowers",
    [
      "Liri does not cry. She is furious in the efficient way of children. \"They aren't flowers,\" she informs you, as if you had been taken in.",
      "You take her home. Mira's hug is a whole policy. Brann forges, very quietly, a little bell for the girl's pack that will never ring for the fog.",
    ],
    [
      {
        id: "liri.home",
        label: "Leave her in the inn's weather",
        apply: (s) => {
          let next = setFlag(s, "side.liri.done");
          next = addXp(next, 24);
          next = addItem(next, "ward_charm");
          next = remember(next, "You brought Liri home. The village became slightly more real.");
          return travel(next, "emberhearth");
        },
      },
    ],
  );
}

function saltmoor(state: GameState): Scene {
  requirePlay(state);
  if (state.event?.id === "vesk.deal") return veskDeal(state);

  if (!flag(state, "salt.intro")) {
    return scene(
      state,
      "salt.intro",
      "Where the Tide Keeps Books",
      [
        "Saltmoor is a dock that outlived its reasons. Nets hang like shed skins. The fog bell is ringing, though no one is pulling the rope.",
        "Captain Rhea watches you with a sailor's math. \"If you're here for the Choir, you're late by a generation. If you're here for Vesk, he's late on purpose.\"",
      ],
      [
        {
          id: "salt.enter",
          label: "Step onto the wet boards",
          apply: (s) => setFlag(s, "salt.intro"),
        },
      ],
    );
  }

  if (!flag(state, "anchor.tide")) {
    return scene(
      state,
      "salt.hub",
      placeName("saltmoor"),
      [
        "Water slaps the pilings in a language you almost know. Far out, shapes stand in the fog the way a choir stands when the conductor has drowned.",
        flag(state, "side.vesk.done")
          ? "Vesk's stall is shuttered. The sea took his ledger and left a smell of cancelled numbers."
          : "A man with too many pockets is trying to look like furniture. Vesk.",
      ],
      [
        {
          id: "salt.rhea",
          label: "Ask Rhea about the bell",
          apply: (s) => overlay(s, "talk.rhea"),
        },
        {
          id: "salt.vesk",
          label: "Corner Vesk the smuggler",
          hideIfFlag: "side.vesk.done",
          apply: (s) => {
            const next = clone(s);
            next.event = { id: "vesk.deal", step: 0 };
            return next;
          },
        },
        {
          id: "salt.choir",
          label: "Walk the fog toward the Choir",
          apply: (s) => beginCombat(s, "drowned_choir"),
        },
        {
          id: "salt.explore",
          label: "Work the alleys",
          apply: (s) => beginCombat(advanceTime(s, 1), "drowned_singer"),
        },
      ],
    );
  }

  return scene(
    state,
    "salt.after",
    "A Quiet Harbor",
    [
      "The bell is still. Sailors do not know how to stand without a sound to hate. Rhea nods once, which from her is a parade.",
      "The Tide Anchor in your pack makes nearby water hesitate.",
    ],
    [
      {
        id: "salt.explore2",
        label: "Search the abandoned holds",
        apply: (s) => addItem(addGold(advanceTime(s, 1), 12), "smoke_vial"),
      },
    ],
  );
}

function rheaTalk(state: GameState): Scene {
  return scene(
    state,
    "salt.rhea",
    "Captain Rhea",
    [
      `"The Choir took the crews that sang on the way down. It wants a descant. Don't give it your true name. Give it a fight, or a better song. I was never musical."`,
      "She flicks you a flask she claims is medicinal. It is not.",
    ],
    [
      {
        id: "rhea.take",
        label: "Accept the flask",
        hideIfFlag: "rhea.flask",
        apply: (s) => addItem(setFlag(s, "rhea.flask"), "emberflask"),
      },
      {
        id: "rhea.back",
        label: "Leave her the horizon",
        apply: clearEvent,
      },
    ],
  );
}

function veskDeal(state: GameState): Scene {
  return {
    id: "salt.vesk",
    title: "A Man Made of Pockets",
    kicker: "Debts are just stories that bite.",
    locationId: "saltmoor",
    body: [
      `Vesk smiles with the wrong number of teeth. "Ledger's cursed. Choir-ink. You fetch it off my barge, I tell you where the Tide sits, and I stop owing a god I don't believe in."`,
    ],
    choices: visibleChoices(state, [
      {
        id: "vesk.yes",
        label: "Take the job",
        apply: (s) => beginCombat(s, "drowned_singer"),
      },
      {
        id: "vesk.threat",
        label: "Take the ledger by presence (Presence 14)",
        skill: { stat: "presence", dc: 14 },
        apply: (s) => {
          let next = addItem(s, "vesks_ledger");
          next = setFlag(next, "side.vesk.done");
          next = addXp(next, 18);
          next = addGold(next, 20);
          next.event = null;
          return remember(next, "You taxed a smuggler and the sea pretended not to see.");
        },
        onFail: (s) => beginCombat(s, "cutpurse"),
      },
      {
        id: "vesk.no",
        label: "Walk away",
        apply: (s) => {
          const next = clone(s);
          next.event = null;
          return next;
        },
      },
    ]),
  };
}

function archives(state: GameState): Scene {
  requirePlay(state);
  if (!flag(state, "arch.intro")) {
    return scene(
      state,
      "arch.intro",
      "The Quiet Stacks",
      [
        "The Sunken Archives are not underwater. They are simply where knowledge went when it was tired of being useful. Shelves descend in terraces. Lamps burn with catalog-fire.",
        "A librarian who is also a rumor turns. She has no mouth and is somehow still shushing you.",
      ],
      [
        {
          id: "arch.enter",
          label: "Tread softly",
          apply: (s) => setFlag(s, "arch.intro"),
        },
      ],
    );
  }

  return scene(
    state,
    "arch.hub",
    placeName("archives"),
    [
      "Cards whisper in drawers. Your own file, you suspect, is already being updated.",
      flag(state, "side.page.done")
        ? "The Remaining Page in your pack is blank. It is the loudest blank you have ever carried."
        : "In a locked aisle: a page that matches the burn on an apostate's eyelid — or wants to.",
      "A shade in a scholar's coat is citing you under its breath.",
    ],
    [
      {
        id: "arch.page",
        label: "Seek the Remaining Page",
        hideIfFlag: "side.page.done",
        apply: (s) => {
          const check = skillCheck(s, "aether", 13);
          if (check.ok) {
            let next = addItem(check.state, "forbidden_page");
            next = setFlag(next, "side.page.done");
            next = addXp(next, 22);
            return remember(next, "You took the rest of the sentence the Archives tried to bury.");
          }
          return beginCombat(check.state, "archive_shade");
        },
      },
      {
        id: "arch.shade",
        label: "Confront the citing shade",
        apply: (s) => beginCombat(s, "archive_shade"),
      },
      {
        id: "arch.read",
        label: "Read about the Hollow King",
        apply: (s) => overlay(setFlag(s, "lore.read"), "lore.king"),
      },
    ],
  );
}

function kingLore(state: GameState): Scene {
  return scene(
    state,
    "arch.lore",
    "A Catalog of Absences",
    [
      "The entry is cross-referenced under King, Hollow; Veil, Habit of; and You, Eventually.",
      "\"The Unmade learned faces from being looked at. A Bound who carries three Anchors can close the Rift, open it, or sit in the chair and become the looking.\"",
      "In the margin, a later hand: Do not become the looking.",
    ],
    [
      {
        id: "lore.back",
        label: "Close the book before it closes you",
        apply: clearEvent,
      },
    ],
  );
}

function cathedral(state: GameState): Scene {
  requirePlay(state);
  if (!flag(state, "cath.intro")) {
    return scene(
      state,
      "cath.intro",
      "The Burnt See",
      [
        "The Ashen Cathedral is a ribcage around an old light. Glass still throws saints onto the floor; the saints look surprised to be colors.",
        "Sister Ash meets you with hands that are mostly bandage. \"She is still in the chancel. Our Saint. She will not cool. The Anchor is in her, or she is in it. I have stopped splitting the difference.\"",
      ],
      [
        {
          id: "cath.enter",
          label: "Enter the nave",
          apply: (s) => setFlag(s, "cath.intro"),
        },
      ],
    );
  }

  if (!flag(state, "anchor.ash")) {
    return scene(
      state,
      "cath.hub",
      placeName("cathedral"),
      [
        "Heat without comfort. Hymns without singers. The Saint of Cinders stands where the altar was, a woman-shaped wick.",
        anchorsHeld(state) >= 2
          ? "The other Anchors in your pack answer her like tuning forks. This will not be a conversation."
          : "She looks at you as if you were a late parishioner.",
      ],
      [
        {
          id: "cath.saint",
          label: "Approach the Saint",
          apply: (s) => beginCombat(s, "saint_of_cinders"),
        },
        {
          id: "cath.sister",
          label: "Pray with Sister Ash",
          apply: (s) => heal(setFlag(s, "ash.prayed"), 10, 6),
        },
        {
          id: "cath.explore",
          label: "Walk the side-chapels",
          apply: (s) => beginCombat(advanceTime(s, 1), "cinder_acolyte"),
        },
      ],
    );
  }

  return scene(
    state,
    "cath.after",
    "A Church of Cooled Light",
    [
      "The Saint is a sculpture of her own ending. Sister Ash sits on the steps and laughs once, a sound like a dropped spoon.",
      `"The Rift is behind the east window, if a window can be a throat. You have what it asked for. I will not bless you. Blessings here catch."`,
    ],
    [
      {
        id: "cath.rest",
        label: "Sit in the ash and breathe",
        apply: (s) => heal(s, 8, 8),
      },
    ],
  );
}

function rift(state: GameState): Scene {
  requirePlay(state);
  if (state.event?.id === "ending.choice") return endingChoice(state);

  if (!flag(state, "king.fallen")) {
    return scene(
      state,
      "rift.court",
      "The Unmade Court",
      [
        "There is no ground, only the agreement of ground. The sky is a draft. Your memories arrive slightly before you, looking disappointed.",
        "The Hollow King is a habit wearing a crown. When it speaks, it uses Mira's cadence, then yours, then a clerk's.",
        `"Three nails," it says. "You brought the hammer. Sit. Or strike. Or become the looking."`,
      ],
      [
        {
          id: "king.fight",
          label: "Refuse the chair",
          apply: (s) => beginCombat(s, "hollow_king"),
        },
        {
          id: "king.wisp",
          label: "Banish a nearby wisp first",
          apply: (s) => beginCombat(s, "rift_wisp"),
        },
      ],
    );
  }

  return endingChoice(state);
}

function endingChoice(state: GameState): Scene {
  requirePlay(state);
  return {
    id: "ending.choice",
    title: "The Looking",
    kicker: "A story is a Veil too. Someone has to hold it shut.",
    locationId: "rift",
    body: [
      "The King is a hole again. The Anchors are heavy the way vows are heavy. The Chronicler — you feel it now, the quill in the walls of the world — waits for a verb.",
      "You can mend the Veil and go home smaller and real. You can tear it and let Thalorin finish becoming a rumor. You can sit in the chair and write everyone from the inside.",
    ],
    choices: [
      {
        id: "end.mend",
        label: "Mend the Veil",
        apply: (s) => ending(s, "mend"),
      },
      {
        id: "end.tear",
        label: "Tear it wide",
        apply: (s) => ending(s, "tear"),
      },
      {
        id: "end.sit",
        label: "Sit in the chair. Become the looking.",
        apply: (s) => ending(s, "chronicler"),
      },
    ],
  };
}

function ending(state: GameState, id: "mend" | "tear" | "chronicler"): GameState {
  requirePlay(state);
  const next = clone(state);
  next.screen = "ending";
  next.combat = null;
  next.event = null;
  const name = next.player.name;
  if (id === "mend") {
    next.ending = {
      id,
      title: "THE NAILS HOLD",
      body: [
        `You drive the Anchors back into the sky. It hurts like honesty.`,
        `Thalorin remains. Emberhearth's lamps look suddenly ordinary, which is a miracle. Mira does not ask what you paid. She sets out bread.`,
        `${name} is Bound still, but the dark has worse errands now. On quiet nights you hear a quill stop moving, as if someone closed a book on purpose.`,
      ],
    };
  } else if (id === "tear") {
    next.ending = {
      id,
      title: "A RUMOR OF A WORLD",
      body: [
        "You pull. The Veil comes away like old varnish.",
        "Some people become stories about themselves and are happier. Some people are not. Saltmoor sighs into the open sea and is finally, perfectly, lost.",
        `${name} walks a Thalorin that can no longer agree on its own edges. The Chronicler writes faster and faster, then laughs, then is the laugh.`,
      ],
    };
  } else {
    next.ending = {
      id,
      title: "THE LOOKING",
      body: [
        "The chair fits. Of course it does. It was measured in your sleep.",
        `You are the Chronicler now. You write Mira's kettle, Liri's cruel flowers, the Stag's regret. You are kind when you remember to be, which is not always.`,
        `In a later age, a Bound will wake in Emberhearth with your handwriting behind their eyes. They will think it is God. You will not correct them. You are busy.`,
      ],
    };
  }
  return next;
}

function shopScene(state: GameState, title: string): Scene {
  requirePlay(state);
  const lines = SHOP.map((s) => `${s.defId} — ${s.cost}g`).join("; ");
  return {
    id: "shop",
    title,
    kicker: "Iron, glass, and the rumor of safety.",
    locationId: state.world.locationId,
    body: [
      "Brann does not haggle. He considers it a form of lying to metal.",
      `On the board: emberflask 12g, aether tea 12g, smoke vial 16g, ward charm 18g, travel bread 5g, cinder greatsword 70g, warden plate 64g.`,
      `Your purse: ${state.player.gold} gold. (${lines})`,
    ],
    choices: [
      ...SHOP.map((entry) => ({
        id: `buy.${entry.defId}`,
        label: `Buy ${ITEMS[entry.defId]?.name ?? entry.defId} (${entry.cost}g)`,
        requireGold: entry.cost,
        apply: (s: GameState) => addItem(addGold(s, -entry.cost), entry.defId),
      })),
      {
        id: "shop.leave",
        label: "Leave the heat of the forge",
        apply: (s) => {
          const next = clone(s);
          next.event = null;
          return next;
        },
      },
    ],
  };
}

function defeatWake(state: GameState): Scene {
  requirePlay(state);
  return {
    id: "wake.defeat",
    title: "Returned, Reluctantly",
    kicker: "Death was busy. It sent you back with a note.",
    locationId: "emberhearth",
    body: [
      "Mira's ceiling. Again. Your gold is lighter. Your bones are arguing.",
      `"I will not say I told you so," Mira says, telling you so. "Eat. Then go be a problem somewhere north."`,
    ],
    choices: [
      {
        id: "wake.up",
        label: "Sit up anyway",
        apply: (s) => {
          const next = clone(s);
          next.event = null;
          return next;
        },
      },
    ],
  };
}

function victoryScene(state: GameState, enemyId: string): Scene | null {
  requirePlay(state);
  if (enemyId === "hollow_stag") {
    return scene(
      state,
      "win.stag",
      "Ember Anchor",
      [
        "The lantern-heart cools into a coal that will not go out. When you lift it, the wood exhales. Somewhere a path decides to exist again.",
        "You have one nail of three.",
      ],
      [
        {
          id: "win.stag.go",
          label: "Carry the heat",
          apply: (s) => {
            const next = clone(s);
            next.event = null;
            return next;
          },
        },
      ],
    );
  }
  if (enemyId === "drowned_choir") {
    return scene(
      state,
      "win.choir",
      "Tide Anchor",
      [
        "Silence arrives like a dockworker and sits down. In the foam: a knot of drowned gold. The fog, embarrassed, thins.",
        "Two nails, if you already robbed a king of the wood. Or one, and the sea still watching.",
      ],
      [
        {
          id: "win.choir.go",
          label: "Pocket the sea's apology",
          apply: (s) => {
            const n = clone(s);
            n.event = null;
            return n;
          },
        },
      ],
    );
  }
  if (enemyId === "saint_of_cinders") {
    return scene(
      state,
      "win.saint",
      "Ash Anchor",
      [
        "She thanks you by going out. The fingerbone left behind is black as a wick and twice as holy as it should be.",
        "Sister Ash does not watch. Some mercies are private.",
      ],
      [
        {
          id: "win.saint.go",
          label: "Do not pray. Leave.",
          apply: (s) => {
            const next = clone(s);
            next.event = null;
            return next;
          },
        },
      ],
    );
  }
  if (enemyId === "drowned_singer" && !flag(state, "side.vesk.done") && state.world.locationId === "saltmoor") {
    return scene(
      state,
      "win.singer.vesk",
      "A Wet Ledger",
      [
        "The barge yields a book that drips numbers. Vesk takes it like a man taking back a tooth. He pays, which startles you both.",
      ],
      [
        {
          id: "vesk.pay",
          label: "Take the coin and the silence",
          apply: (s) => {
            let next = addItem(s, "vesks_ledger");
            next = setFlag(next, "side.vesk.done");
            next = addGold(next, 18);
            next.event = null;
            return next;
          },
        },
      ],
    );
  }
  if (enemyId === "veilwolf" && flag(state, "side.liri.started") && !flag(state, "side.liri.done")) {
    const next = clone(state);
    next.event = { id: "side.liri.found", step: 0 };
    return liriFound(next);
  }
  return scene(
    state,
    "win.generic",
    "It Ends, For Now",
    ["The thing that wanted you stops wanting. You take a breath that has to be earned."],
    [
      {
        id: "win.ok",
        label: "Go on",
        apply: (s) => {
          const n = clone(s);
          n.event = null;
          return n;
        },
      },
    ],
  );
}

function overlay(state: GameState, id: string): GameState {
  const next = clone(state);
  next.event = { id, step: 0 };
  return next;
}

function clearEvent(state: GameState): GameState {
  const next = clone(state);
  next.event = null;
  return next;
}

export function deriveScene(state: GameState): Scene {
  requirePlay(state);
  if (!flag(state, "intro.done")) return intro(state);

  const ev = state.event?.id;
  if (ev?.startsWith("victory.")) {
    const enemyId = ev.slice("victory.".length);
    const win = victoryScene(state, enemyId);
    if (win) return win;
  }
  if (ev === "talk.mira") return miraTalk(state);
  if (ev === "talk.pell") return pellTalk(state);
  if (ev === "talk.liri") return liriStart(state);
  if (ev === "talk.rhea") return rheaTalk(state);
  if (ev === "lore.king") return kingLore(state);
  if (ev === "shop") return shopScene(state, "Brann's Forge");
  if (ev === "wake.defeat") return defeatWake(state);
  if (ev === "ending.choice") return endingChoice(state);
  if (ev === "side.liri.found") return liriFound(state);
  if (ev === "vesk.deal") return veskDeal(state);
  if (ev === "ember.coin") {
    return scene(
      state,
      "ember.coin",
      "A Useless Saint",
      ["Under the stone: six gold and a prayer so old it has become a joke. You take the gold. The joke can stay."],
      [{ id: "coin.ok", label: "Pocket it", apply: clearEvent }],
    );
  }
  if (ev === "ember.flask") {
    return scene(
      state,
      "ember.flask",
      "A Kind Neighbor",
      ["Someone left an Emberflask on a windowsill 'for the Bound, if we get one.' You are, inconveniently, one."],
      [{ id: "flask.ok", label: "Nod to the empty window", apply: clearEvent }],
    );
  }

  const loc = state.world.locationId;
  if (loc === "emberhearth") return emberhearth(state);
  if (loc === "veilwood") return veilwood(state);
  if (loc === "saltmoor") return saltmoor(state);
  if (loc === "archives") return archives(state);
  if (loc === "cathedral") return cathedral(state);
  return rift(state);
}

export function applyChoice(state: GameState, choiceId: string): GameState {
  requirePlay(state);
  const sceneNow = deriveScene(state);
  const choice = sceneNow.choices.find((c) => c.id === choiceId);
  if (!choice) return state;
  if (choice.requireGold && state.player.gold < choice.requireGold) return state;
  if (choice.requireItem && itemCount(state.player, choice.requireItem) < 1) return state;

  if (choice.skill) {
    const check = skillCheck(state, choice.skill.stat, choice.skill.dc);
    if (!check.ok) {
      const failer = choice.onFail ?? ((s: GameState) => hurt(s, 4));
      return failer(check.state);
    }
    return choice.apply(check.state);
  }
  return choice.apply(state);
}
