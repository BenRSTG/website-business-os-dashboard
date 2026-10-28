import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";
import { TASK_CONTACT_TYPE_LABELS } from "@/lib/leads/constants";
import { completeTask, postponeTask } from "@/lib/leads/actions";
import type { TaskWithLead } from "@/lib/leads/types";

export function TodayList({ tasks }: { tasks: TaskWithLead[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine fälligen Aufgaben.</p>;
  }

  return (
    <ul className="divide-y">
      {tasks.map((task) => {
        const overdue = task.due_at ? new Date(task.due_at) < new Date() : false;
        return (
          <li key={task.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              {task.lead ? (
                <Link
                  href={`/leads/${task.lead.id}`}
                  className="rounded-sm text-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {task.lead.company_name}
                </Link>
              ) : null}
              <p className="truncate text-xs text-muted-foreground">
                {TASK_CONTACT_TYPE_LABELS[task.contact_type]}
                {task.note ? ` · ${task.note}` : ""} ·{" "}
                <span className={overdue ? "text-destructive" : undefined}>
                  {formatDateTime(task.due_at)}
                </span>
              </p>
            </div>
            <form action={completeTask.bind(null, task.id)}>
              <Button type="submit" variant="outline" size="sm">
                Erledigt
              </Button>
            </form>
            <form action={postponeTask.bind(null, task.id)}>
              <Button type="submit" variant="ghost" size="sm">
                Auf morgen
              </Button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
