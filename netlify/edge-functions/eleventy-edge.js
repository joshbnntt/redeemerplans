import {
  EleventyEdge,
  precompiledAppData,
} from "./_generated/eleventy-edge-app.js";

export default async (request, context) => {
  try {
    let edge = new EleventyEdge("edge", {
      request,
      context,
      precompiled: precompiledAppData,

      // default is [], add more keys to opt-in e.g. ["appearance", "username"]
      cookies: [],
    });

    edge.config((eleventyConfig) => {
      // Add some custom Edge-specific configuration
      // e.g. Fancier json output
      // eleventyConfig.addFilter("json", obj => JSON.stringify(obj, null, 2));
      eleventyConfig.addShortcode("date", (startdate, offset = 0) => {
        if (startdate === "") return ""
        const date = new Date(startdate)
        date.setDate(date.getDate() + offset)
        const day = date.toLocaleString("en-US", {day:"numeric"})
        const month = date.toLocaleString("en-US", {month: "short"})
    
        return `<div class="flex flex-col justify-center">
        <span class="font-bold">${ month }</span>
        <span class="countdown font-mono text-xl">
          <span style="--value:${day};">${day}</span>
        </span>
      </div>`
      })
    });

    return await edge.handleResponse();
  } catch (e) {
    console.log("ERROR", { e });
    return context.next(e);
  }
};
