module.exports = {
  layout: "readingplan",
  tags: ["plans"],
  eleventyComputed: {
    meta: {
      title: data => data.title,
      description: data => data.description
    }
  }
};
