const path = require("path");
const pluginRss = require("@11ty/eleventy-plugin-rss"); // needed for absoluteUrl SEO feature
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const EleventyVitePlugin = require("@11ty/eleventy-plugin-vite");
const Image = require("@11ty/eleventy-img");
const yaml = require("js-yaml"); // Because yaml is nicer than json for editors
require("dotenv").config();
const generateBibleLinks = require('./src/lib/generateBibleLinks')
const baseUrl = process.env.BASE_URL || "http://localhost:8080";
console.log("baseUrl is set to ...", baseUrl);

const globalSiteData = {
  title: "Redeemer Bible Reading",
  description: "Bible Reading Plans for Redeemer Church in North Santa Rosa County, Florida",
  locale: "en",
  baseUrl: baseUrl,
  lang: "en-US"
};

module.exports = function(eleventyConfig) {
  /* --- GLOBAL DATA --- */

  eleventyConfig.addGlobalData("site", globalSiteData);

  /* --- YAML SUPPORT --- */

  eleventyConfig.addDataExtension("yaml", contents => yaml.load(contents));
  eleventyConfig.addDataExtension("yml", contents => yaml.load(contents));

  /* --- PASSTHROUGHS --- */

  eleventyConfig.addPassthroughCopy("src/assets/css");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "public/images" });
  eleventyConfig.addPassthroughCopy({"src/admin": "public/admin"});

  /* --- PLUGINS --- */

  eleventyConfig.addPlugin(pluginRss); // just includes absolute url helper function
  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(EleventyVitePlugin, {});

  /* --- SHORTCODES --- */

  // Image shortcode config
  let defaultSizesConfig = "(min-width: 1200px) 1400px, 100vw"; // above 1200px use a 1400px image at least, below just use 100vw sized image

  eleventyConfig.addShortcode("image", async function(
    src,
    alt,
    sizes = defaultSizesConfig
  ) {
    console.log(`Generating image(s) from:  ${src}`);
    let metadata = await Image(src, {
      widths: [800, 1500],
      formats: ["webp", "jpeg"],
      urlPath: "/images/",
      outputDir: "./_site/images/",
      filenameFormat: function(id, src, width, format, options) {
        const extension = path.extname(src);
        const name = path.basename(src, extension);
        return `${name}-${width}w.${format}`;
      },
    });

    let imageAttributes = {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async",
    };

    return Image.generateHTML(metadata, imageAttributes);
  });

  // Output year for copyright notices
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

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

  eleventyConfig.addShortcode("day", (startdate, offset = 0) => {
    if (startdate === "") return ""
    const date = new Date(startdate)
    date.setDate(date.getDate() + offset)
    return date.toLocaleString("en-US", {day:"numeric"})
  })
  eleventyConfig.addShortcode("weekday", (startdate, offset = 0) => {
    if (startdate === "") return ""
    const date = new Date(startdate)
    date.setDate(date.getDate() + offset)
    return date.toLocaleString("en-US", {weekday:"long"})
  })
  eleventyConfig.addShortcode("month", (startdate, offset = 0) => {
    if (startdate === "") return ""
    const date = new Date(startdate)
    date.setDate(date.getDate() + offset)
    return date.toLocaleString("en-US", {month:"medium"})
  })
  eleventyConfig.addShortcode("readingdate", (startdate, offset = 0) => {
    if (startdate === "") return ""
    const date = new Date(startdate)
    date.setDate(date.getDate() + offset)
    return date.toLocaleString("en-US", {month:"2-digit",day:"2-digit",year:"numeric"})
  })

  eleventyConfig.addShortcode("youversion", generateBibleLinks)

  /* --- FILTERS --- */

  // Custom Random Helper Filter (useful for ID attributes)
  eleventyConfig.addFilter("generateRandomIdString", function(prefix) {
    return prefix + "-" + Math.floor(Math.random() * 1000000);
  });

  eleventyConfig.addFilter("split", function(string, separator) {
    return string.split(separator);
  });

  /* --- COLLECTIONS --- */
  eleventyConfig.addCollection("currentPlan", function(collectionApi) {
    return collectionApi.getFilteredByTag("plans").filter(function(item) {
      console.log(item.data.title, item.data.current)
      return item.data.current;
    })
  })

  /* --- BASE CONFIG --- */

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "includes", // this path is releative to input-path (src/)
      layouts: "layouts", // this path is releative to input-path (src/)
      data: "data", // this path is releative to input-path (src/)
    },
    templateFormats: ["njk", "md", "js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
