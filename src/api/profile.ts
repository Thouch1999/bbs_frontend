import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext";
import type { Profile } from "../types";
import { http } from "./client";
import type { ApiError } from "./types";

export function useProfile() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await http.get<Profile>("/profile/");
      return data;
    },
    enabled: isAuthenticated,
  });
}

type ProfileUpdate = Partial<
  Pick<Profile, "full_name" | "phone" | "preferred_language" | "preferred_currency">
>;

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation<Profile, ApiError, ProfileUpdate>({
    mutationFn: async (body) => {
      const { data } = await http.patch<Profile>("/profile/", body);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data);
    },
  });
}
