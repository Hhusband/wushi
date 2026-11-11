import Redis from "ioredis"

const globalForRedis = globalThis as unknown as { redis: Redis | undefined }

export const redis = globalForRedis.redis || new Redis(process.env.REDIS_URL || "redis://localhost:6379")

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis

export const redisPub = redis
export const redisSub = redis.duplicate()
