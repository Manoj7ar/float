import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

export type Account = Tables<"accounts">;

export function useAccount() {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccount(null);
      setLoading(false);
      return;
    }

    const fetchAccount = async () => {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      // Pick the first onboarding-complete account, or fall back to the most recent
      const completed = data?.find((a) => a.onboarding_complete);
      setAccount(completed || data?.[0] || null);
      setLoading(false);
    };

    fetchAccount();
  }, [user]);

  const updateAccount = async (updates: Partial<Account>) => {
    if (!account) return;
    const { data } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", account.id)
      .select()
      .single();
    if (data) setAccount(data);
    return data;
  };

  const createAccount = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("accounts")
      .insert({ user_id: user.id })
      .select()
      .single();
    if (data) setAccount(data);
    return data;
  };

  return { account, loading, updateAccount, createAccount, setAccount };
}
