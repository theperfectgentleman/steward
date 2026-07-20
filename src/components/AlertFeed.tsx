type AlertItem = {
  id: string;
  type: "blocked" | "completed" | "minutes" | "assignment";
  message: string;
  time: string;
  href?: string;
  committeeId?: string;
  meetingId?: string;
};

const TYPE_STYLES = {
  blocked: "border-l-accent bg-accent/5",
  completed: "border-l-primary bg-primary/5",
  minutes: "border-l-charcoal bg-charcoal/5",
  assignment: "border-l-accent bg-accent/10",
};

type Props = {
  alerts: AlertItem[];
  onAlertClick?: (alert: AlertItem) => void;
};

export function AlertFeed({ alerts, onAlertClick }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-sm text-muted bg-white rounded-xl border border-charcoal/10">
        No alerts right now. All committees are on track.
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {alerts.map((alert) => {
        const content = (
          <>
            <p className="text-sm font-medium text-charcoal leading-snug">{alert.message}</p>
            <time className="text-[11px] text-muted mt-0.5 block">{alert.time}</time>
          </>
        );

        const className = `block w-full px-3 py-2 rounded-lg border-l-4 bg-white border border-charcoal/10 text-left ${TYPE_STYLES[alert.type]}`;

        if (alert.href) {
          return (
            <li key={alert.id}>
              <a
                href={alert.href}
                className={className}
                onClick={() => onAlertClick?.(alert)}
              >
                {content}
              </a>
            </li>
          );
        }

        return (
          <li key={alert.id} className={className}>
            {content}
          </li>
        );
      })}
    </ul>
  );
}

export type { AlertItem };
