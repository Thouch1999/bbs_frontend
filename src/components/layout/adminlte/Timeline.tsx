import type { ReactNode } from "react";

export interface TimelineItem {
  id: string;
  timestamp: ReactNode;
  icon?: string;
  variant?: "info" | "success" | "warning" | "danger";
  content: ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="timeline">
      {items.map((item) => (
        <div key={item.id}>
          <i className="fas fa-circle bg-gray" />
          <div className="timeline-item">
            <span className="time">
              <i className="far fa-clock" /> {item.timestamp}
            </span>
            {item.icon && (
              <h3 className={`timeline-header${item.variant ? ` text-${item.variant}` : ""}`}>
                <i className={item.icon} />
              </h3>
            )}
            <div className="timeline-body">{item.content}</div>
          </div>
        </div>
      ))}
      <div>
        <i className="fas fa-clock bg-gray" />
      </div>
    </div>
  );
}
