import { useQuery } from "@tanstack/react-query";
import { getWorkflowDAGLightweight } from "../../services/workflowsApi";
import { getExecutionDetails } from "../../services/executionsApi";
import type { WorkflowDAGLightweightResponse } from "../../types/workflows";
import type { WorkflowExecution } from "../../types/executions";

export function useRunDAG(runId: string | undefined) {
  return useQuery<WorkflowDAGLightweightResponse>({
    queryKey: ["run-dag", runId],
    queryFn: () => getWorkflowDAGLightweight(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      // Poll more frequently for active runs
      const status = query.state.data?.workflow_status;
      if (status === "running" || status === "pending") return 3000;
      return false;
    },
  });
}

export function useStepDetail(executionId: string | undefined) {
  return useQuery<WorkflowExecution>({
    queryKey: ["step-detail", executionId],
    queryFn: () => getExecutionDetails(executionId!),
    enabled: !!executionId,
  });
}
