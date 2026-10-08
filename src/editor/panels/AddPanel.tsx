import { useMemo, useRef, useState } from "react";
import { Download, Search, Trash2, Upload } from "lucide-react";
import { LIBRARY, LIBRARY_GROUPS } from "../../model/library";
import { NodeIcon } from "../../ui/nodeIcons";
import { armDrag } from "../dnd";
import { insertNode } from "../actions";
import { importComponents, removeComponent, useLibrary } from "../library";
import { useEditor } from "../../state/store";
import { downloadFile } from "../../lib/download";
import type { SavedComponent } from "../../storage/db";
import { nodeSchema } from "../../model/schema";

export function AddPanel() {
  const [query, setQuery] = useState("");
  const components = useLibrary((s) => s.components);
  const toast = useEditor((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const items = useMemo(() => LIBRARY.filter((i) => !q || `${i.label} ${i.description} ${i.keywords}`.toLowerCase().includes(q)), [q]);
  const mine = components.filter((c) => !q || c.name.toLowerCase().includes(q));

  return (
    <>
      <div className="panel-head">
        <h2>Add components</h2>
        <p>Click to add after the selection, or drag onto the canvas.</p>
      </div>
      <div className="panel-pad">
        <div className="search">
          <Search size={14} />
          <input className="input" placeholder="Search components" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search components" />
        </div>

        {(mine.length > 0 || !q) && (
          <div className="lib-group">
            <h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              My components
              <span className="row" style={{ gap: 2 }}>
                <button className="icon-btn small" title="Import components" aria-label="Import components" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} />
                </button>
                {components.length > 0 && (
                  <button
                    className="icon-btn small"
                    title="Export my components"
                    aria-label="Export my components"
                    onClick={() =>
                      downloadFile(
                        "signature-components.json",
                        JSON.stringify({ format: "signature-studio.components", version: 1, components }, null, 2),
                        "application/json",
                      )
                    }
                  >
                    <Download size={13} />
                  </button>
                )}
              </span>
            </h3>
            {mine.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>
                Select any component and choose <em>Save component</em> to reuse it here.
              </p>
            ) : (
              <div className="lib-grid">
                {mine.map((c) => (
                  <SavedItem key={c.id} item={c} />
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const data = JSON.parse(await f.text());
                  if (data?.format !== "signature-studio.components" || !Array.isArray(data.components)) throw new Error();
                  const valid = (data.components as SavedComponent[]).filter(
                    (c) => c && typeof c.name === "string" && nodeSchema.safeParse(c.node).success && c.node.type !== "column",
                  );
                  const n = await importComponents(valid);
                  toast(`Imported ${n} components`, "success");
                } catch {
                  toast("That file isn't a component collection.", "error");
                }
              }}
            />
          </div>
        )}

        {LIBRARY_GROUPS.map((g) => {
          const list = items.filter((i) => i.group === g);
          if (!list.length) return null;
          return (
            <div className="lib-group" key={g}>
              <h3>{g}</h3>
              <div className="lib-grid">
                {list.map((item) => {
                  const sample = item.create();
                  return (
                    <button
                      key={item.id}
                      className="lib-item"
                      title={item.description}
                      data-testid={`lib-${item.id}`}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        armDrag(e, { kind: "new", create: item.create }, item.label, () => insertNode(item.create()));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          insertNode(item.create());
                        }
                      }}
                    >
                      <span className="ico">
                        <NodeIcon type={sample.type} />
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SavedItem({ item }: { item: SavedComponent }) {
  return (
    <div style={{ position: "relative" }}>
      <button
        className="lib-item"
        style={{ width: "100%" }}
        title={item.name}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          armDrag(e, { kind: "new", create: () => structuredClone(item.node) }, item.name, () => insertNode(structuredClone(item.node)));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            insertNode(structuredClone(item.node));
          }
        }}
      >
        <span className="ico">
          <NodeIcon type={item.node.type} />
        </span>
        <span>{item.name}</span>
      </button>
      <button
        className="icon-btn small"
        style={{ position: "absolute", right: 2, top: 5 }}
        aria-label={`Delete ${item.name}`}
        onClick={() => removeComponent(item.id)}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
