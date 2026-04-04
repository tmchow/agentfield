import { useQuery } from "@tanstack/react-query";
import { getNodesSummary } from "../../services/api";
import type { AgentNodeSummary } from "../../types/agentfield";

interface NodesSummaryResponse {
  nodes: AgentNodeSummary[];
  count: number;
}

export function useAgents() {
  return useQuery<NodesSummaryResponse>({
    queryKey: ["agents"],
    queryFn: () => getNodesSummary(),
    refetchInterval: 10_000, // 10s for health updates
  });
}
