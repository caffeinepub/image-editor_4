import { useQuery } from "@tanstack/react-query";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";

export function useActor() {
  const actorQuery = useQuery<backendInterface>({
    queryKey: ["actor"],
    queryFn: async () => {
      return await createActorWithConfig();
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  return {
    actor: actorQuery.data || null,
    isFetching: actorQuery.isFetching,
  };
}
