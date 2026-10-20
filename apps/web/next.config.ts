import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // `pg` es externo en el servidor (evita que el bundler lo incluya).
  serverExternalPackages: ["pg"],
  // Los paquetes del workspace son TypeScript sin compilar.
  transpilePackages: ["@mercurio/domain", "@mercurio/db"],
};

export default nextConfig;
