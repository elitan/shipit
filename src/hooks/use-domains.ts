import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type AddDomainInput,
  type UpdateDomainInput,
} from "@/lib/api";

export function useDomains(serviceId: string) {
  return useQuery({
    queryKey: ["services", serviceId, "domains"],
    queryFn: () => api.domains.list(serviceId),
  });
}

export function useAddDomain(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddDomainInput) => api.domains.add(serviceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["services", serviceId, "domains"],
      });
    },
  });
}

export function useUpdateDomain(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDomainInput }) =>
      api.domains.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["services", serviceId, "domains"],
      });
    },
  });
}

export function useDeleteDomain(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.domains.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["services", serviceId, "domains"],
      });
    },
  });
}

export function useVerifyDomainDns(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.domains.verifyDns(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["services", serviceId, "domains"],
      });
    },
  });
}
