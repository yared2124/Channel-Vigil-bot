import { Redis } from "@upstash/redis";

export interface ChannelBinding {
  channelId: string;
  ownerId: string;
  channelTitle: string;
  connectedAt: string;
}

// In-memory fallback if Redis/KV is not configured
const memoryChannelStore = new Map<string, ChannelBinding>();
const memoryUserChannels = new Map<string, string[]>();

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (url && token) {
    try {
      return new Redis({ url, token });
    } catch (e) {
      console.warn("[Storage] Failed to initialize Redis client:", e);
      return null;
    }
  }
  return null;
}

function normalizeChannelId(channelId: number | string): string {
  const idStr = String(channelId).trim();
  // Ensure consistent ID representation
  if (!idStr.startsWith("-100") && /^\d+$/.test(idStr)) {
    return `-100${idStr}`;
  }
  return idStr;
}

/**
 * Associates a channel with the user who added the bot as administrator.
 */
export async function saveChannelOwner(
  channelId: number | string,
  ownerId: number | string,
  channelTitle: string
): Promise<void> {
  const cleanChannelId = normalizeChannelId(channelId);
  const cleanOwnerId = String(ownerId);

  const binding: ChannelBinding = {
    channelId: cleanChannelId,
    ownerId: cleanOwnerId,
    channelTitle,
    connectedAt: new Date().toISOString(),
  };

  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.set(`channel_owner:${cleanChannelId}`, JSON.stringify(binding));
      await redis.sadd(`user_channels:${cleanOwnerId}`, cleanChannelId);
      console.log(`[Storage] Saved channel ${cleanChannelId} (${channelTitle}) for owner ${cleanOwnerId} in Redis`);
      return;
    } catch (err) {
      console.error("[Storage] Redis set failed, falling back to memory:", err);
    }
  }

  // Memory fallback
  memoryChannelStore.set(cleanChannelId, binding);
  const existing = memoryUserChannels.get(cleanOwnerId) || [];
  if (!existing.includes(cleanChannelId)) {
    existing.push(cleanChannelId);
    memoryUserChannels.set(cleanOwnerId, existing);
  }
  console.log(`[Storage] Saved channel ${cleanChannelId} (${channelTitle}) for owner ${cleanOwnerId} in Memory`);
}

/**
 * Retrieves the owner User ID for a given channel.
 */
export async function getChannelOwner(
  channelId: number | string
): Promise<string | null> {
  const cleanChannelId = normalizeChannelId(channelId);
  const redis = getRedisClient();

  if (redis) {
    try {
      const data = await redis.get<string | ChannelBinding>(`channel_owner:${cleanChannelId}`);
      if (data) {
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        return parsed.ownerId || null;
      }
    } catch (err) {
      console.error("[Storage] Redis get failed:", err);
    }
  }

  // Memory fallback
  const mem = memoryChannelStore.get(cleanChannelId);
  return mem ? mem.ownerId : null;
}

/**
 * Removes channel mapping when bot is removed from a channel.
 */
export async function removeChannelOwner(
  channelId: number | string,
  ownerId?: number | string
): Promise<void> {
  const cleanChannelId = normalizeChannelId(channelId);
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.del(`channel_owner:${cleanChannelId}`);
      if (ownerId) {
        await redis.srem(`user_channels:${String(ownerId)}`, cleanChannelId);
      }
      return;
    } catch (err) {
      console.error("[Storage] Redis del failed:", err);
    }
  }

  // Memory fallback
  memoryChannelStore.delete(cleanChannelId);
  if (ownerId) {
    const list = memoryUserChannels.get(String(ownerId)) || [];
    memoryUserChannels.set(
      String(ownerId),
      list.filter((id) => id !== cleanChannelId)
    );
  }
}

/**
 * Lists all channels monitored by a specific user.
 */
export async function getUserChannels(
  ownerId: number | string
): Promise<ChannelBinding[]> {
  const cleanOwnerId = String(ownerId);
  const redis = getRedisClient();

  if (redis) {
    try {
      const channelIds = await redis.smembers(`user_channels:${cleanOwnerId}`);
      if (channelIds && channelIds.length > 0) {
        const bindings: ChannelBinding[] = [];
        for (const cid of channelIds) {
          const raw = await redis.get<string | ChannelBinding>(`channel_owner:${cid}`);
          if (raw) {
            bindings.push(typeof raw === "string" ? JSON.parse(raw) : raw);
          }
        }
        return bindings;
      }
      return [];
    } catch (err) {
      console.error("[Storage] Redis getUserChannels failed:", err);
    }
  }

  // Memory fallback
  const list = memoryUserChannels.get(cleanOwnerId) || [];
  return list
    .map((cid) => memoryChannelStore.get(cid))
    .filter((b): b is ChannelBinding => Boolean(b));
}
