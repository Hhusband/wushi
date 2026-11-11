import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["ioredis", "prisma", "@prisma/client"],
}

export default nextConfig
