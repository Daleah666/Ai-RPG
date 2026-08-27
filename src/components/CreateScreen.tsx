import { useState } from "react";
import type { Dispatch } from "../App";
import { CLASSES } from "../content/classes";
import { ORIGINS } from "../content/origins";
import type { ClassId, OriginId } from "../types";

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
const ORIGIN_IDS = Object.keys(ORIGINS) as OriginId[];

export function CreateScreen({ dispatch }: { dispatch: Dispatch }) {
  const [name, setName] = useState("");
  const [classId, setClassId] = useState<ClassId>("warden");
  const [originId, setOriginId] = useState<OriginId>("foundling");
  const cls = CLASSES[classId];
  const origin = ORIGINS[originId];

  return (
    <main className="create">
      <button className="link back" onClick={() => dispatch({ type: "BACK_TITLE" })}>
        ← Title
      </button>
      <p className="eyebrow">Character</p>
      <h2>Who walks into the tear?</h2>
      <label className="name-field">
        Name
        <input
          value={name}
          maxLength={24}
          placeholder="A name the Veil can catch"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <h3>Origin</h3>
      <div className="card-row">
        {ORIGIN_IDS.map((id) => (
          <button
            key={id}
            className={`card ${originId === id ? "on" : ""}`}
            onClick={() => setOriginId(id)}
          >
            <strong>{ORIGINS[id].name}</strong>
            <span>{ORIGINS[id].place}</span>
          </button>
        ))}
      </div>
      <p className="blurb">{origin.blurb}</p>

      <h3>Calling</h3>
      <div className="card-row">
        {CLASS_IDS.map((id) => (
          <button
            key={id}
            className={`card ${classId === id ? "on" : ""}`}
            onClick={() => setClassId(id)}
          >
            <strong>{CLASSES[id].name}</strong>
            <span>{CLASSES[id].title}</span>
          </button>
        ))}
      </div>
      <p className="blurb">{cls.blurb}</p>
      <p className="creed">“{cls.creed}”</p>

      <button
        className="btn primary"
        onClick={() =>
          dispatch({
            type: "CREATE",
            name: name.trim() || "Bound One",
            classId,
            originId,
          })
        }
      >
        Wake in Emberhearth
      </button>
    </main>
  );
}
