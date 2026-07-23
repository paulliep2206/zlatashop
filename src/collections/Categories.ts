import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'URL-friendly path (e.g., "khudozhnya-literatura")' },
    },
    { name: 'parent', type: 'relationship', relationTo: 'categories', hasMany: false },
    // ─── NEW: CATEGORY PROMOTIONAL BANNER CONFIGURATION ───
    {
      name: 'banner',
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
  ],
}
