import { describe, expect, it, vi } from "vitest";
import { preparePushSubscription, type PushEnvironment } from "@/lib/push-notifications";

function subscription() {
  return {
    endpoint: "https://push.example/subscription",
    toJSON: () => ({ endpoint: "https://push.example/subscription", keys: { p256dh: "public-key", auth: "auth-key" } }),
  } as unknown as PushSubscription;
}

function environment(permission: NotificationPermission, existing: PushSubscription | null) {
  const subscribe = vi.fn().mockResolvedValue(subscription());
  const requestPermission = vi.fn().mockResolvedValue("granted");
  const value: PushEnvironment = {
    permission,
    requestPermission,
    register: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(existing), subscribe } }),
  };
  return { value, requestPermission, subscribe };
}

describe("push notification preparation", () => {
  it("reuses a persistent browser subscription without asking permission again", async () => {
    const setup = environment("granted", subscription());
    const result = await preparePushSubscription("AQAB", false, setup.value);
    expect(result).toEqual({ status: "ready", subscription: { endpoint: "https://push.example/subscription", keys: { p256dh: "public-key", auth: "auth-key" } } });
    expect(setup.requestPermission).not.toHaveBeenCalled();
    expect(setup.subscribe).not.toHaveBeenCalled();
  });

  it("restores a missing subscription automatically when permission is already granted", async () => {
    const setup = environment("granted", null);
    expect(await preparePushSubscription("AQAB", false, setup.value)).toMatchObject({ status: "ready" });
    expect(setup.subscribe).toHaveBeenCalledOnce();
  });

  it("waits for a user gesture before requesting permission for the first time", async () => {
    const setup = environment("default", null);
    expect(await preparePushSubscription("AQAB", false, setup.value)).toEqual({ status: "idle" });
    expect(setup.requestPermission).not.toHaveBeenCalled();
  });
});
