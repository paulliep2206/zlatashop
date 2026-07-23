import type { CollectionConfig } from 'payload'

import { Banner } from '@/blocks/Banner/config'
import { Carousel } from '@/blocks/Carousel/config'
import { ThreeItemGrid } from '@/blocks/ThreeItemGrid/config'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { adminOnly } from '@/access/adminOnly'
import { Archive } from '@/blocks/ArchiveBlock/config'
import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { FormBlock } from '@/blocks/Form/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { ImageText } from '@/blocks/ImageText/config'
import { hero } from '@/fields/hero'
import { slugField } from 'payload'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { revalidatePage, revalidateDelete } from './hooks/revalidatePage'

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOrPublishedStatus,
    update: adminOnly,
  },
  admin: {
    group: 'Content',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'pages',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'pages',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    // ─── NEW: PAGE PROMOTIONAL BANNER CONFIGURATION ───
    {
      name: 'hero-banner',
      type: 'group', // Groups fields neatly together under a single database object key
      admin: {
        description: 'Optional promotional banner displayed at the top of this category page.',
      },
      fields: [
        {
          name: 'showBanner',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Toggle visibility of the banner on the storefront' },
        },
        {
          name: 'Mobile image',
          type: 'upload',
          relationTo: 'media', // Points directly to your secure cloud Media collection
          admin: {
            condition: (data, siblingData) => siblingData?.showBanner === true,
          },
        },
        {
          name: 'Desktop image',
          type: 'upload',
          relationTo: 'media', // Points directly to your secure cloud Media collection
          admin: {
            condition: (data, siblingData) => siblingData?.showBanner === true,
          },
        },
        {
          name: 'title',
          type: 'text',
          admin: {
            placeholder: 'e.g., Знижки до -30% на Фантастику!',
            condition: (data, siblingData) => siblingData?.showBanner === true,
          },
        },
        {
          name: 'description',
          type: 'text',
          admin: {
            placeholder: 'e.g., Купуйте найкращі романи літа за вигідною ціною.',
            condition: (data, siblingData) => siblingData?.showBanner === true,
          },
        },
        // ─── REPLACED: DYNAMIC LINKING SYSTEM GROUP ───
        {
          name: 'linkConfig',
          type: 'group',
          admin: {
            condition: (data, siblingData) => siblingData?.showBanner === true,
            description: 'Configure the action button destination link.',
          },
          fields: [
            {
              name: 'linkType',
              type: 'select',
              defaultValue: 'internal',
              options: [
                { label: 'Internal Link', value: 'internal' },
                { label: 'Custom External Link', value: 'external' },
              ],
            },
            // Field 1: Appears ONLY if linkType is External
            {
              name: 'externalUrl',
              type: 'text',
              admin: {
                placeholder: 'e.g., https://partner-site.com',
                condition: (data, siblingData) => siblingData?.linkType === 'external',
              },
            },
            // Field 2: Appears ONLY if linkType is Internal
            {
              name: 'internalLink',
              type: 'relationship',
              // This parameter opens up polymorphic lookups across multiple tables!
              relationTo: ['pages', 'products', 'categories'],
              hasMany: false,
              admin: {
                condition: (data, siblingData) => siblingData?.linkType === 'internal',
                description: 'Search and choose an internal destination document.',
              },
            },
            {
              name: 'buttonText',
              type: 'text',
              defaultValue: 'Детальніше',
              admin: { placeholder: 'e.g., Купити зараз, Читати у блозі' },
            },
          ],
        },
      ],
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'publishedOn',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === 'published' && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            hero,
            {
              name: 'layout',
              type: 'blocks',
              blocks: [
                CallToAction,
                Content,
                MediaBlock,
                ImageText,
                Archive,
                Carousel,
                ThreeItemGrid,
                Banner,
                FormBlock,
              ],
              required: true,
            },
          ],
          label: 'Content',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    slugField(),
  ],
  hooks: {
    afterChange: [revalidatePage],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: true,
    },
    maxPerDoc: 50,
  },
}
