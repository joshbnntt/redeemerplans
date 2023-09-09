/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{njk,js,html,md,yml,yaml}",
    "./.eleventy.js"
  ],
  theme: {
    extend: {},
  },
  daisyui: {
    themes: [
      {
        mytheme: {
          primary: "#0c4a6e",
          secondary: "#e7e5e4",
          accent: "#0369a1",
          neutral: "#1c1917",
          "base-100": "#E9E7E7",
          info: "#0284c7",
          success: "#36D399",
          warning: "#FBBD23",
          error: "#F87272",
        },
      },
      {
        mydarktheme: {
          primary: "#0c4a6e",
          secondary: "#e7e5e4",
          accent: "#0369a1",
          neutral: "#23282f",
          "base-100": "#212121"
        }
      }
    ],
    darkTheme: "mydarktheme"
  },
  plugins: [require("@tailwindcss/forms"), require("daisyui")],
}

