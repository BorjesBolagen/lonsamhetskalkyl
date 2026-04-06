import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    proxyClientMaxBodySize: "50mb", // Se till att vi kan hantera filer upp till 50MB i uppladdning av historisk data med CSV-
  },
};

export default nextConfig;
