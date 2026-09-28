import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fluxo",
    short_name: "Fluxo",
    description: "Sua rotina de estudos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f0e8",
    theme_color: "#173f35",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
