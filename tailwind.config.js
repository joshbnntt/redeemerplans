/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{njk,js,html,md,yml,yaml}",
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
    ],
  },
  plugins: [require("@tailwindcss/forms"), require("daisyui")],
}

