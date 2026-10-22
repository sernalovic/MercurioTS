import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // `pg` es externo en el servidor (evita que el bundler lo incluya).
  serverExternalPackages: ["pg"],
  // Los paquetes del workspace son TypeScript sin compilar.
  transpilePackages: ["@mercurio/domain", "@mercurio/db"],
  // La API `/api/v1` la usa la aplicación de escritorio, que vive en un
  // origen propio: se abre el CORS para sus peticiones. El resto de la
  // web queda igual (las cookies de sesión son httpOnly y se quedan).
  async headers() {
    return [{
      source: "/api/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
      ],
    }];
  },
};

export default nextConfig;
