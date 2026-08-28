import { useMemo, useState } from "react";
import type { Dispatch } from "../App";
import { CLASSES } from "../content/classes";
import {
  AGES,
  DRIVES,
  EYES,
  FEARS,
  generateEpithet,
  HAIR,
  KITS,
  MARKS,
  POINT_BUY,
  POINT_CAP,
  PRONOUNS,
  SKIN,
  spentTotal,
  STAT_KEYS,
  TEMPERS,
  VICES,
  VIRTUES,
  defaultIdentity,
} from "../content/identity";
import { ORIGINS } from "../content/origins";
import { SKILLS } from "../content/skills";
import type {
  AgeId,
  ClassId,
  DriveId,
  EyeId,
  FearId,
  HairId,
  Identity,
  KitId,
  MarkId,
  OriginId,
  PronounId,
  SkinId,
  Stat,
  TemperId,
  ViceId,
  VirtueId,
} from "../types";
import { Portrait } from "./Portrait";

const STEPS = [
  "Face",
  "Origin",
  "Calling",
  "Nature",
  "Wound",
  "Craft",
  "Recital",
] as const;

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
const ORIGIN_IDS = Object.keys(ORIGINS) as OriginId[];

export function CreateScreen({ dispatch }: { dispatch: Dispatch }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState<ClassId>("warden");
  const [originId, setOriginId] = useState<OriginId>("foundling");
  const [id, setId] = useState<Identity>(() => defaultIdentity("warden", "foundling"));

  const patch = (partial: Partial<Identity>) => {
    setId((prev) => {
      const next = { ...prev, ...partial };
      next.epithet = generateEpithet(classId, next.temper, next.drive);
      return next;
    });
  };

  const chooseClass = (nextClass: ClassId) => {
    setClassId(nextClass);
    setId((prev) => {
      const skills = CLASSES[nextClass].skills;
      const signatureSkill = skills.includes(prev.signatureSkill) ? prev.signatureSkill : skills[0]!;
      return {
        ...prev,
        signatureSkill,
        epithet: generateEpithet(nextClass, prev.temper, prev.drive),
      };
    });
  };

  const spentLeft = POINT_BUY - spentTotal(id.spent);
  const cls = CLASSES[classId];
  const origin = ORIGINS[originId];
  const previewName = name.trim() || "Bound One";

  const canNext = useMemo(() => {
    if (step === 5) return spentLeft === 0 || spentLeft === POINT_BUY || spentLeft >= 0;
    return true;
  }, [step, spentLeft]);

  const bump = (stat: Stat, dir: 1 | -1) => {
    setId((prev) => {
      const cur = prev.spent[stat];
      const nextVal = cur + dir;
      if (nextVal < 0 || nextVal > POINT_CAP) return prev;
      if (dir === 1 && spentTotal(prev.spent) >= POINT_BUY) return prev;
      return { ...prev, spent: { ...prev.spent, [stat]: nextVal } };
    });
  };

  const wake = () => {
    dispatch({
      type: "CREATE",
      name: previewName,
      classId,
      originId,
      identity: { ...id, epithet: generateEpithet(classId, id.temper, id.drive) },
    });
  };

  return (
    <main className="create create-deep">
      <button className="link back" onClick={() => dispatch({ type: "BACK_TITLE" })}>
        ← Title
      </button>
      <p className="eyebrow">Character atelier · {step + 1} / {STEPS.length}</p>
      <h2>{STEPS[step]}</h2>
      <ol className="stepper">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button className={i === step ? "on" : i < step ? "done" : ""} onClick={() => setStep(i)}>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="create-grid">
        <div className="create-main">
          {step === 0 && (
            <>
              <label className="name-field">
                Name
                <input
                  value={name}
                  maxLength={24}
                  placeholder="A name the Veil can catch"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <h3>Pronouns</h3>
              <div className="card-row tight">
                {(Object.keys(PRONOUNS) as PronounId[]).map((pid) => (
                  <button
                    key={pid}
                    className={`card ${id.pronouns === pid ? "on" : ""}`}
                    onClick={() => patch({ pronouns: pid })}
                  >
                    <strong>{PRONOUNS[pid].name}</strong>
                  </button>
                ))}
              </div>
              <h3>Hair</h3>
              <Pick ids={Object.keys(HAIR) as HairId[]} map={HAIR} value={id.hair} onPick={(hair) => patch({ hair })} />
              <h3>Eyes</h3>
              <Pick ids={Object.keys(EYES) as EyeId[]} map={EYES} value={id.eyes} onPick={(eyes) => patch({ eyes })} />
              <h3>Complexion</h3>
              <Pick ids={Object.keys(SKIN) as SkinId[]} map={SKIN} value={id.skin} onPick={(skin) => patch({ skin })} />
              <h3>Mark</h3>
              <Pick ids={Object.keys(MARKS) as MarkId[]} map={MARKS} value={id.mark} onPick={(mark) => patch({ mark })} />
            </>
          )}

          {step === 1 && (
            <>
              <p className="blurb">Where the story caught you first. This changes opening, kit, and how Mira looks at you.</p>
              <div className="card-row">
                {ORIGIN_IDS.map((oid) => (
                  <button
                    key={oid}
                    className={`card ${originId === oid ? "on" : ""}`}
                    onClick={() => setOriginId(oid)}
                  >
                    <strong>{ORIGINS[oid].name}</strong>
                    <span>{ORIGINS[oid].place}</span>
                  </button>
                ))}
              </div>
              <p className="blurb">{origin.blurb}</p>
            </>
          )}

          {step === 2 && (
            <>
              <p className="blurb">How you stand in a fight, and how the Chronicler describes your hands.</p>
              <div className="card-row">
                {CLASS_IDS.map((cid) => (
                  <button
                    key={cid}
                    className={`card ${classId === cid ? "on" : ""}`}
                    onClick={() => chooseClass(cid)}
                  >
                    <strong>{CLASSES[cid].name}</strong>
                    <span>{CLASSES[cid].title}</span>
                  </button>
                ))}
              </div>
              <p className="blurb">{cls.blurb}</p>
              <p className="creed">“{cls.creed}”</p>
            </>
          )}

          {step === 3 && (
            <>
              <h3>Temper</h3>
              <Pick ids={Object.keys(TEMPERS) as TemperId[]} map={TEMPERS} value={id.temper} onPick={(temper) => patch({ temper })} />
              <h3>Virtue</h3>
              <p className="hint">A standing +1 to its stat, and a bias the world can smell.</p>
              <Pick ids={Object.keys(VIRTUES) as VirtueId[]} map={VIRTUES} value={id.virtue} onPick={(virtue) => patch({ virtue })} />
              <h3>Vice</h3>
              <p className="hint">{VICES[id.vice].combat}</p>
              <Pick ids={Object.keys(VICES) as ViceId[]} map={VICES} value={id.vice} onPick={(vice) => patch({ vice })} />
            </>
          )}

          {step === 4 && (
            <>
              <h3>Age of the Bound</h3>
              <Pick ids={Object.keys(AGES) as AgeId[]} map={AGES} value={id.age} onPick={(age) => patch({ age })} />
              <h3>Fear</h3>
              <p className="hint">Certain places will press on this. The Chronicler will not be kind about it.</p>
              <Pick ids={Object.keys(FEARS) as FearId[]} map={FEARS} value={id.fear} onPick={(fear) => patch({ fear })} />
              <h3>Drive</h3>
              <p className="hint">What you will still want when the Rift asks you to choose.</p>
              <Pick ids={Object.keys(DRIVES) as DriveId[]} map={DRIVES} value={id.drive} onPick={(drive) => patch({ drive })} />
            </>
          )}

          {step === 5 && (
            <>
              <h3>Spend {POINT_BUY} points</h3>
              <p className="hint">
                {spentLeft} remaining. Cap {POINT_CAP} per stat. These sit on top of calling, origin, age, mark, and virtue.
              </p>
              <ul className="point-buy">
                {STAT_KEYS.map((stat) => (
                  <li key={stat}>
                    <span>{stat}</span>
                    <button type="button" onClick={() => bump(stat, -1)} disabled={id.spent[stat] <= 0}>
                      −
                    </button>
                    <b>{id.spent[stat]}</b>
                    <button
                      type="button"
                      onClick={() => bump(stat, 1)}
                      disabled={id.spent[stat] >= POINT_CAP || spentLeft <= 0}
                    >
                      +
                    </button>
                  </li>
                ))}
              </ul>
              <h3>Signature art</h3>
              <p className="hint">One calling skill that hits harder. Marked in combat with a brand.</p>
              <div className="card-row">
                {cls.skills.map((sid) => (
                  <button
                    key={sid}
                    className={`card ${id.signatureSkill === sid ? "on" : ""}`}
                    onClick={() => patch({ signatureSkill: sid })}
                  >
                    <strong>{SKILLS[sid]?.name ?? sid}</strong>
                    <span>{SKILLS[sid]?.desc}</span>
                  </button>
                ))}
              </div>
              <h3>Travel kit</h3>
              <Pick ids={Object.keys(KITS) as KitId[]} map={KITS} value={id.kit} onPick={(kit) => patch({ kit })} />
            </>
          )}

          {step === 6 && (
            <div className="recital">
              <p className="creed">
                {previewName}, {id.epithet}.
              </p>
              <p className="blurb">{origin.blurb}</p>
              <p className="blurb">{cls.blurb}</p>
              <ul className="recital-list">
                <li>
                  {PRONOUNS[id.pronouns].name} · {AGES[id.age].name} · {TEMPERS[id.temper].name}
                </li>
                <li>
                  Virtue: {VIRTUES[id.virtue].name} · Vice: {VICES[id.vice].name}
                </li>
                <li>
                  Fears {FEARS[id.fear].name.toLowerCase()} · Drive: {DRIVES[id.drive].name}
                </li>
                <li>
                  Mark: {MARKS[id.mark].name} · Kit: {KITS[id.kit].name}
                </li>
                <li>Signature: {SKILLS[id.signatureSkill]?.name}</li>
                <li>
                  Extra points:{" "}
                  {STAT_KEYS.filter((s) => id.spent[s] > 0)
                    .map((s) => `${s} +${id.spent[s]}`)
                    .join(", ") || "none spent"}
                </li>
              </ul>
              <p className="hint">{MARKS[id.mark].wake}</p>
            </div>
          )}
        </div>

        <aside className="create-aside">
          <Portrait hair={id.hair} eyes={id.eyes} skin={id.skin} mark={id.mark} />
          <p className="who">{previewName}</p>
          <p className="muted">{id.epithet}</p>
          <p className="muted">
            {origin.name} · {cls.name}
          </p>
        </aside>
      </div>

      <div className="create-foot">
        <button className="btn" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Next
          </button>
        ) : (
          <button className="btn primary" onClick={wake}>
            Wake in Emberhearth
          </button>
        )}
      </div>
    </main>
  );
}

function Pick<T extends string>({
  ids,
  map,
  value,
  onPick,
}: {
  ids: T[];
  map: Record<T, { name: string; blurb: string }>;
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="card-row">
      {ids.map((pid) => (
        <button key={pid} className={`card ${value === pid ? "on" : ""}`} onClick={() => onPick(pid)}>
          <strong>{map[pid].name}</strong>
          <span>{map[pid].blurb}</span>
        </button>
      ))}
    </div>
  );
}
