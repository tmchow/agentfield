import { useStepDetail } from "@/hooks/queries";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "@/components/ui/icon-bridge";
import { formatDuration } from "./RunTrace";

export function StepDetail({ executionId }: { executionId: string }) {
  const { data: execution, isLoading } = useStepDetail(executionId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-60" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8">
        Step not found
      </div>
    );
  }

  const hasError = Boolean(execution.error_message);
  const hasOutput = execution.output_data != null;
  const hasInput = execution.input_data != null;
  const notes = execution.notes ?? [];

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {/* Step header */}
        <div>
          <h3 className="text-sm font-semibold font-mono">
            {execution.reasoner_id}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agent: {execution.agent_node_id}
            {" · "}
            Duration: {formatDuration(execution.duration_ms)}
            {execution.workflow_depth != null && (
              <> · Depth: {execution.workflow_depth}</>
            )}
          </p>
        </div>

        {/* Input section */}
        {hasInput && (
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left">
              <ChevronDown className="size-3 transition-transform [[data-state=open]_&]:rotate-0 [[data-state=closed]_&]:-rotate-90" />
              Input
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 rounded-md bg-muted p-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {JSON.stringify(execution.input_data, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Output or Error */}
        {hasError ? (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-xs font-medium text-destructive">Error</p>
            <p className="text-xs mt-1 font-mono whitespace-pre-wrap break-all">
              {execution.error_message}
            </p>
          </div>
        ) : hasOutput ? (
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left">
              <ChevronDown className="size-3 transition-transform [[data-state=open]_&]:rotate-0 [[data-state=closed]_&]:-rotate-90" />
              Output
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 rounded-md bg-muted p-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {JSON.stringify(execution.output_data, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            No output
          </div>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left">
              <ChevronDown className="size-3 transition-transform [[data-state=open]_&]:rotate-0 [[data-state=closed]_&]:-rotate-90" />
              Notes ({notes.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 flex flex-col gap-2">
                {notes.map((note, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-muted p-2 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {new Date(note.timestamp).toLocaleTimeString()}
                    </span>{" "}
                    {note.message}
                    {note.tags?.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="ml-1 text-[10px] py-0 h-4"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </ScrollArea>
  );
}
