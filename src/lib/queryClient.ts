import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes (prevents constant spinners)
            gcTime: 1000 * 60 * 10, // 10 minutes
            refetchOnWindowFocus: true,
            retry: 1,
        },
    },
});
