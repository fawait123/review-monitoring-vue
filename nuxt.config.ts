import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxtjs/color-mode"],
  components: [{ path: "~/components/ui", pathPrefix: false, ignore: ["**/*.ts"] }],
  css: ["~/assets/css/main.css"],
  app: {
    pageTransition: { name: "page", mode: "out-in" },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  colorMode: {
    classSuffix: "",
    preference: "dark",
    fallback: "dark",
  },
  nitro: {
    externals: {
      // native/wasm deps — jangan di-bundle nitro
      external: ["@earendil-works/pi-coding-agent"],
    },
  },
  typescript: {
    strict: true,
  },
});
