module.exports = {
  layout: "readingplan",
  tags: ["plans"],
  start: "",
  current: false,
  eleventyComputed: {
    meta: {
      title: data => data.title,
      description: data => data.description
    },
    permalink: function(data) {
      return `/plan/${this.slug(data.title)}/`
    }
  }
};
