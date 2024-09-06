import { siteConfig } from '@/config'
import rss from '@astrojs/rss'
import { getSortedPosts } from '@utils/content-utils'
import type { APIContext } from 'astro'
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'

const parser = new MarkdownIt()

export async function GET(context: APIContext) {
  const blog = await getSortedPosts()
  const { site } = context

  if (!site) {
    throw new Error('Missing site metadata')
  }

  return rss({
    title: siteConfig.title,
    description: siteConfig.subtitle || 'No description',
    site,
    items: blog
      .map((post) => {
        return {
          title: post.data.title,
          pubDate: post.data.published,
          description: post.data.description || '',
          link: `/posts/${post.slug}/`,
          content: sanitizeHtml(parser.render(post.body), {
            // https://stackoverflow.com/questions/12229572/php-generated-xml-shows-invalid-char-value-27-message
            textFilter: (text, tagName) =>
              text.replace(
                /[^\x09\x0A\x0D\x20-\xFF\x85\xA0-\uD7FF\uE000-\uFDCF\uFDE0-\uFFFD]/gm,
                '',
              ),
            allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
          }),
        }
      })
      .slice(0, 20),
    customData: `<language>${siteConfig.lang}</language>`,
  })
}
