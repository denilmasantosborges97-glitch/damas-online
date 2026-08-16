import { useEffect, useState } from "react";
import {
  countUniquePresenceUsers,
  getOrCreateGlobalPresenceKey,
  GLOBAL_ONLINE_CHANNEL,
  loadingOnlineCount,
  type OnlineCountState,
  unavailableOnlineCount
} from "./globalPresence";
import { hasSupabaseConfig, supabase } from "./supabaseClient";

export function useGlobalOnlineCount(): OnlineCountState {
  const [presenceKey] = useState(() =>
    getOrCreateGlobalPresenceKey(typeof window !== "undefined" ? window.localStorage : undefined)
  );
  const [onlineCount, setOnlineCount] = useState<OnlineCountState>(
    hasSupabaseConfig ? loadingOnlineCount : unavailableOnlineCount
  );

  useEffect(() => {
    if (!supabase) {
      setOnlineCount(unavailableOnlineCount);
      return;
    }

    const client = supabase;
    let active = true;
    const channel = client
      .channel(GLOBAL_ONLINE_CHANNEL, {
        config: {
          presence: {
            key: presenceKey
          }
        }
      })
      .on("presence", { event: "sync" }, () => {
        if (!active) return;
        setOnlineCount({
          status: "ready",
          count: countUniquePresenceUsers(channel.presenceState() as Record<string, unknown[]>)
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ online: true }).then(() => {
            if (!active) return;
            setOnlineCount({
              status: "ready",
              count: countUniquePresenceUsers(channel.presenceState() as Record<string, unknown[]>)
            });
          });
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setOnlineCount(unavailableOnlineCount);
        }
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [presenceKey]);

  return onlineCount;
}
