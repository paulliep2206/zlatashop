import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { adminOnly } from '@/access/adminOnly'

export const Media: CollectionConfig = {
  admin: {
    group: 'Content',
  },
  slug: 'media',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
    modifyResponseHeaders: ({ headers }) => {
      // Allow streamed files through when the storage adapter reports a zero length.
      if (headers.get('content-length') === '0') {
        headers.delete('content-length')
      }

      // Vercel's image optimizer takes the browser cache lifetime for `/_next/image` from this
      // header (it ignores `minimumCacheTTL`). Filenames aren't content-hashed, so keep it short
      // enough that a re-upload under the same name shows up within about a day.
      // See docs/specs/image-cache-lifetime.md.
      headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')

      return headers
    },
    // ─── ADD / UPDATE THIS DYNAMIC THUMBNAIL FUNCTION ───
    adminThumbnail: ({ doc }) => {
      // If the document has a direct cloud URL from Uploadthing, use it instantly
      if (doc && doc.url) {
        return doc.url as string
      }
      // Local development fallback path
      return `/api/media/file/${doc.filename}`
    },
  },
}
