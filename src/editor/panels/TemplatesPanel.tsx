import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { useEditor } from "../../state/store";
import { CATEGORIES, PROFESSION_SUGGESTIONS, TEMPLATES, TEMPLATE_MAP, type Template } from "../../templates/templates";
import { TemplateThumb, imagesKeyOf } from "../TemplateThumb";
import { toggleFavorite, usePrefs } from "../../state/prefs";
import type { Profile } from "../../model/types";

export function TemplateGrid({
  onPick,
  compact,
  previewProfile,
  pickedId,
}: {
  onPick: (t: Template) => void;
  compact?: boolean;
  /** Profile to preview with (before a project exists). */
  previewProfile?: Profile;
  pickedId?: string;
}) {
  const project = useEditor((s) => (previewProfile ? null : s.project));
  const favorites = usePrefs((s) => s.favorites);
  const recent = usePrefs((s) => s.recent);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const imagesKey = useMemo(() => (project ? imagesKeyOf(project.root) : undefined), [project]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = TEMPLATES;
    if (filter === "Favourites") items = favorites.map((id) => TEMPLATE_MAP[id]).filter(Boolean);
    else if (filter === "Recent") items = recent.map((id) => TEMPLATE_MAP[id]).filter(Boolean);
    else if (filter.startsWith("For: ")) {
      const s = PROFESSION_SUGGESTIONS.find((p) => p.label === filter.slice(5));
      items = (s?.templates ?? []).map((id) => TEMPLATE_MAP[id]).filter(Boolean);
    } else if (filter !== "All") items = items.filter((t) => t.category === filter);
    if (q) items = items.filter((t) => `${t.name} ${t.category} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(q));
    return items;
  }, [query, filter, favorites, recent]);

  const filters = ["All", ...(favorites.length ? ["Favourites"] : []), ...(recent.length ? ["Recent"] : []), ...CATEGORIES];

  return (
    <>
      <div className="search">
        <Search size={14} />
        <input
          className="input"
          placeholder={`Search ${TEMPLATES.length} templates`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search templates"
        />
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {filters.map((f) => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      {!compact && (
        <div className="field">
          <select
            className="select small"
            aria-label="Suggest templates for my profession"
            value={filter.startsWith("For: ") ? filter : ""}
            onChange={(e) => setFilter(e.target.value || "All")}
          >
            <option value="">Suggest for my profession…</option>
            {PROFESSION_SUGGESTIONS.map((p) => (
              <option key={p.label} value={`For: ${p.label}`}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {list.length === 0 && (
        <div className="empty">
          <strong>No templates found</strong>
          Try another word or category.
        </div>
      )}
      <div className="tpl-grid">
        {list.map((t) => (
          <div key={t.id} style={{ position: "relative" }}>
            <button
              className="tpl-card"
              style={{ width: "100%" }}
              aria-current={(pickedId ?? project?.templateId) === t.id}
              onClick={() => onPick(t)}
              data-testid={`template-${t.id}`}
            >
              <TemplateThumb template={t} profile={previewProfile ?? project?.profile} imagesKey={imagesKey} assets={project?.assets} />
              <div className="tpl-meta">
                <div>
                  <strong>{t.name}</strong>
                  <div className="muted">{t.category}</div>
                </div>
              </div>
            </button>
            <button
              className="icon-btn small fav"
              aria-label={favorites.includes(t.id) ? `Remove ${t.name} from favourites` : `Add ${t.name} to favourites`}
              aria-pressed={favorites.includes(t.id)}
              onClick={() => toggleFavorite(t.id)}
            >
              <Star size={13} fill={favorites.includes(t.id) ? "var(--brass)" : "none"} color={favorites.includes(t.id) ? "var(--brass)" : "currentColor"} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export function TemplatesPanel() {
  const openDialog = useEditor((s) => s.openDialog);
  return (
    <>
      <div className="panel-head">
        <h2>Templates</h2>
        <p>Layouts keep your details, images and custom work.</p>
      </div>
      <div className="panel-pad">
        <TemplateGrid onPick={(t) => openDialog("applyTemplate", t.id)} />
      </div>
    </>
  );
}
