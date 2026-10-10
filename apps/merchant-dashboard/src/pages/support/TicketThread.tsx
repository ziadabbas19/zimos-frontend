import { cn } from "@store-builder/ui";
import type { SupportTicketMessage } from "@store-builder/api-client";
import { SkeletonBar } from "@/components/DataState";
import { IconSupport } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useSupportLabels } from "./supportLabels";

/**
 * The messages of a ticket as a conversation: what the store wrote on the end
 * side, what Zimos support answered on the start side, each with who wrote it
 * and when. Used by the ticket's page and by its Quick Look.
 */
export function TicketMessages({ messages, label, className }: { messages: readonly SupportTicketMessage[]; label: string; className?: string }) {
  const labels = useSupportLabels();
  return (
    <ol aria-label={label} className={cn("flex flex-col gap-3", className)}>
      {messages.map((m) => {
        const fromSupport = m.authorType === "admin";
        const author = fromSupport ? m.authorName : (m.authorName ?? labels.you);
        return (
          <li key={m.id} className={cn("flex", fromSupport ? "justify-start" : "justify-end")}>
            <div
              data-slot="chat-bubble"
              data-dir={fromSupport ? "in" : "out"}
              className={cn(
                "max-w-[88%] rounded-[1.25rem] px-3.5 py-2.5 text-[15px] leading-6 text-ink sm:max-w-[78%]",
                fromSupport ? "rounded-es-sm bg-paper-raised ring-1 ring-line" : "rounded-ee-md bg-primary-soft"
              )}
            >
              <p className="mb-0.5 flex flex-wrap items-center gap-x-1.5 text-xs leading-5 text-ink-soft">
                {fromSupport && <IconSupport className="size-3.5 shrink-0 text-primary" aria-hidden />}
                {author && (
                  <span className="font-semibold text-ink">
                    <bdi>{author}</bdi>
                  </span>
                )}
                <time dateTime={m.createdAt} title={formatDateTime(m.createdAt)}>
                  {formatRelativeTime(m.createdAt)}
                </time>
              </p>
              {/* dir="auto": the words are in whatever language they were typed. */}
              <p className="wrap-break-word whitespace-pre-wrap" dir="auto">
                {m.body}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A ticket while its messages load: the shape of the conversation. */
export function TicketThreadSkeleton() {
  const bones: Array<["start" | "end", string]> = [
    ["end", "w-64"],
    ["start", "w-72"],
    ["end", "w-44"],
  ];
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {bones.map(([side, width], i) => (
        <div key={i} className={cn("flex", side === "end" && "justify-end")}>
          <SkeletonBar className={cn("h-16 max-w-[78%] rounded-[1.25rem]", width)} />
        </div>
      ))}
    </div>
  );
}
