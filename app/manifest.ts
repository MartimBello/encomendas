import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Encomendas",
    short_name: "Encomendas",
    description: "Registo de encomendas das lojas para a cozinha.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f7",
    theme_color: "#4a7366",
    lang: "pt-PT",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
