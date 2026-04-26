# Redeemer Bible Reading Plans

A modern, performant website for publishing and managing Bible reading plans for Redeemer Church in North Santa Rosa County, Florida. Built with 11ty, Vite, Tailwind CSS, and Alpine.js.

## Features

- ✨ **Static Site Generation** with 11ty for fast, secure, low-maintenance hosting
- 🎨 **Responsive Design** using Tailwind CSS and DaisyUI components
- ⚡ **Performance Optimized** with image optimization, lazy loading, and PWA support
- 📱 **Progressive Web App** capabilities with offline support
- 🔗 **SEO Optimized** with meta tags, sitemap generation, and RSS feeds
- 📖 **Interactive Bible Navigation** with Turbo drive adapter and Alpine.js
- 📅 **Flexible Reading Plans** with date calculations and iCal generation
- 🎯 **Dynamic Navigation** with automatic menu generation from data files
- 📱 **Mobile-First** responsive layout for all devices

## Tech Stack

- **Static Site Generator**: [11ty (Eleventy)](https://www.11ty.dev/) v2
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with [DaisyUI](https://daisyui.com/)
- **Frontend Framework**: [Alpine.js](https://alpinejs.dev/)
- **Navigation**: [Hotwired Turbo](https://turbo.hotwired.dev/)
- **Image Optimization**: @11ty/eleventy-img
- **PWA**: vite-plugin-pwa with Workbox

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/joshbnntt/redeemerplans.git
   cd redeemerplans
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.sample .env.local
   ```
   Edit `.env.local` and set your `BASE_URL`:
   ```env
   BASE_URL=http://localhost:8080
   ```

### Development

Start the development server with hot reload:

```bash
npm run dev
```

The site will be available at `http://localhost:8080`

**Available scripts:**
- `npm run dev` - Start development server with hot reload
- `npm run serve` - Alias for dev
- `npm start` - Alias for dev
- `npm run watch` - Watch for changes without serving
- `npm run build` - Build for production
- `npm run clean` - Remove the `_site` build directory

## Project Structure

```
redeemerplans/
├── src/
│   ├── _data/              # Global data files (YAML/JSON)
│   ├── _includes/          # Reusable template partials
│   ├── layouts/            # Page layout templates
│   ├── lib/                # Utility functions and helpers
│   ├── assets/
│   │   ├── css/            # PostCSS & Tailwind styles
│   │   ├── js/             # Alpine.js components
│   │   └── images/         # Source images (will be optimized)
│   ├── admin/              # Admin panel files
│   └── pages/              # Page templates
├── .eleventy.js            # 11ty configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
├── package.json            # Dependencies and scripts
└── _site/                  # Generated site output (not committed)
```

## Building & Deployment

### Production Build

```bash
npm run build
```

This generates a static site in the `_site/` directory that can be deployed to any static hosting service.

**Recommended hosting:**
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Any web server with static file serving

### Environment Configuration

For production deployments, set the `BASE_URL` environment variable:

```bash
BASE_URL=https://redeemerplans.com npm run build
```

## Key Features Explained

### Bible Reading Plans

The site manages multiple Bible reading plans with:
- Configurable start dates
- Automatic date calculations
- Bible verse linkage via YouVersion
- Current plan highlighting
- Sorting by date

Plans are defined in data files with YAML format for easy editing.

### Image Optimization

Images are automatically optimized during build:
- WebP and JPEG formats generated
- Multiple width variants (800px, 1500px)
- Lazy loading by default
- Responsive sizing

Add images using the shortcode:
```njk
{% image "src/assets/images/my-image.jpg", "Alt text" %}
```

### Progressive Web App

The site is configured as a PWA with:
- Service worker for offline support
- App manifest
- Installable on mobile devices
- Workbox caching strategy

### Navigation

Automatic navigation menu generation from data files. Configure in `src/_data/navigation.yml`.

## Customization

### Tailwind CSS

Customize colors, fonts, and components in `tailwind.config.js`. The configuration includes DaisyUI themes.

### Global Site Data

Edit site metadata in `.eleventy.js`:
```javascript
const globalSiteData = {
  title: "Redeemer Bible Reading",
  description: "Bible Reading Plans for Redeemer Church in North Santa Rosa County, Florida",
  locale: "en",
  baseUrl: process.env.BASE_URL || "http://localhost:8080",
  lang: "en-US"
};
```

### Adding New Pages

1. Create a new `.md` or `.njk` file in `src/pages/`
2. Add front matter with layout and metadata
3. Write content

Example:
```markdown
---
layout: layouts/base.njk
title: My New Page
---

# My New Page

Content goes here...
```

## Available Shortcodes

The project includes custom shortcodes for common tasks:

- `{% image %}` - Optimized responsive images
- `{% year %}` - Current year (for copyright)
- `{% date startDate, offset %}` - Formatted date display
- `{% day %}`, `{% weekday %}`, `{% month %}` - Date components
- `{% readingdate %}` - Formatted reading date
- `{% youversion %}` - Bible verse links
- `{% padding value, length, char %}` - String padding

## SEO

The site includes comprehensive SEO optimization:
- Meta tags for Open Graph and Twitter
- Sitemap generation
- RSS feed support
- Semantic HTML
- Performance optimization (Core Web Vitals)

## Scripts in package.json

| Script | Purpose |
|--------|---------|
| `dev` / `serve` / `start` | Run development server |
| `watch` | Watch for changes without serving |
| `build` | Generate production-ready site |
| `clean` | Remove generated `_site` directory |

## Dependencies

### Dev Dependencies
- `@11ty/eleventy` - Static site generator
- `@11ty/eleventy-img` - Image optimization
- `@11ty/eleventy-navigation` - Navigation plugin
- `@11ty/eleventy-plugin-rss` - RSS feed generation
- `@11ty/eleventy-plugin-vite` - Vite integration
- `@tailwindcss/forms` - Form styling
- `tailwindcss` - CSS framework
- `daisyui` - UI component library
- `postcss` & `autoprefixer` - CSS processing

### Runtime Dependencies
- `alpinejs` - Lightweight JavaScript framework
- `@hotwired/turbo` - SPA-like navigation
- `alpine-turbo-drive-adapter` - Alpine + Turbo integration
- `@supabase/supabase-js` - Backend integration (if needed)
- `ical-generator` - Generate iCal files for reading plans
- `vite-plugin-pwa` - PWA support

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:8080` | Site base URL for production builds |

## Contributing

To contribute to this project:

1. Create a feature branch
2. Make your changes
3. Test locally with `npm run dev`
4. Submit a pull request

## License

ISC License - See package.json for details

## Support

For issues, questions, or suggestions, please open an [issue on GitHub](https://github.com/joshbnntt/redeemerplans/issues).

---

Built with ❤️ for Redeemer Church
