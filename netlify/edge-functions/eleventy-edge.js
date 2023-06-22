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
      eleventyConfig.addShortcode("thisweek", (plan, startdate, title) => {
        if (startdate === "") return ""

        const today = new Date()
        const day = today.getDay(); // Get the day of the week (0-6, where 0 is Sunday)
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Calculate the difference in days
  
        const firstdayofthisweek = new Date(today.setDate(diff));
        const start = new Date(startdate)
        const differenceInMilliseconds = firstdayofthisweek - start;
        const differenceInDays = Math.floor(differenceInMilliseconds / (1000 * 60 * 60 * 24));
        return plan[differenceInDays]
      })
    });
    
    return await edge.handleResponse();
  } catch (e) {
    console.log("ERROR", { e });
    return context.next(e);
  }
};
