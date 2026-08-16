import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "../../routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  queryClient.setQueryDefaults(["financial-dashboard"], {
    retry: 1,
    retryDelay: 1_000,
    refetchOnWindowFocus: false,
    throwOnError: true,
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
