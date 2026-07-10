type AlertItem = {
  id: string;
  type: "blocked" | "completed" | "minutes";
  message: string;
  time: string;
};

const TYPE_STYLES = {
  blocked: "border-l-accent bg-accent/5",
  completed: "border-l-primary bg-primary/5",
  minutes: "border-l-charcoal bg-charcoal/5",
};

export function AlertFeed({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <div className="p-6 text-center text-muted bg-white rounded-2xl border border-charcoal/10">
        No alerts right now. All committees are on track.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className={`p-4 rounded-xl border-l-4 bg-white border border-charcoal/10 ${TYPE_STYLES[alert.type]}`}
        >
          <p className="text-sm font-medium text-charcoal">{alert.message}</p>
          <time className="text-xs text-muted mt-1 block">{alert.time}</time>
        </li>
      ))}
    </ul>
  );
}

export type { AlertItem };
