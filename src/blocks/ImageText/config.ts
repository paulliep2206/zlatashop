import type { Block } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

export const ImageText: Block = {
  slug: 'imageText',
  interfaceName: 'ImageTextBlock',
  labels: {
    singular: 'Image + Text',
    plural: 'Image + Text Blocks',
  },
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'richText',
      type: 'richText',
      required: true,
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ],
      }),
    },
    {
      name: 'imageFirst',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'When enabled, the image appears on the right on desktop and above the text on mobile.',
      },
    },
  ],
}
