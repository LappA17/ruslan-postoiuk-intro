import { defineConfig } from 'astro/config';

// Served from https://lappa17.github.io/ruslan-postoiuk-intro/.
// With a custom domain: set `site` to the domain, `base` to '/', and add public/CNAME.
export default defineConfig({
  site: 'https://lappa17.github.io',
  base: '/ruslan-postoiuk-intro',
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
});
