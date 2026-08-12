import { PageShell } from "@/components/page-shell";

const changes = [
  {
    version: "v0.2",
    date: "Planned",
    text: "Sidebar layout, dashboard table view, status filters, and add/edit flows.",
  },
  {
    version: "v0.1",
    date: "Prototype",
    text: "Local-first ticket tracking with parked, in transit, and completed states.",
  },
];

export default function ChangelogPage() {
  return (
    <PageShell title="Changelog" description="A simple running log for the dashboard as it grows.">
      <div className="changelog">
        {changes.map((entry) => (
          <article className="changelog-item" key={entry.version}>
            <div className="changelog-head">
              <strong>{entry.version}</strong>
              <span>{entry.date}</span>
            </div>
            <p>{entry.text}</p>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
