import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { ImageText } from '@/blocks/ImageText/config'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { DefaultDocumentIDType, slugField, Where } from 'payload'

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection?.admin,
    defaultColumns: ['title', 'enableVariants', '_status', 'variants.variants'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'products',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'products',
        req,
      }),
    useAsTitle: 'title',
  },
  defaultPopulate: {
    ...defaultCollection?.defaultPopulate,
    title: true,
    slug: true,
    variantOptions: true,
    variants: true,
    enableVariants: true,
    gallery: true,
    priceInUSD: true,
    inventory: true,
    meta: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'author', type: 'text', required: false },
    { name: 'sku', type: 'text', required: true, unique: true },

    // --- 1. PRODUCT TYPE FIELD ---
    {
      name: 'productType',
      type: 'select',
      required: true,
      defaultValue: 'simple',
      options: [
        { label: 'Simple (Physical Book)', value: 'simple' },
        { label: 'Configurable (Has Variants)', value: 'configurable' },
        { label: 'Virtual (E-Book)', value: 'virtual' },
      ],
    },
    // --- VARIANT RELATIONSHIP ---
    // This field appears ONLY if the type is Configurable.
    // It lets you link multiple "Simple" products as variants.
    {
      name: 'variants',
      type: 'relationship',
      relationTo: 'products', // References its own collection!
      hasMany: true,
      admin: {
        condition: (data) => data?.productType === 'configurable',
        description: 'Attach the Simple products that act as variants for this book.',
      },
      // Optional: Filter the selection dropdown to only show "simple" products
      filterOptions: {
        productType: {
          equals: 'simple',
        },
      },
    },
    // --- PRICING FIELDS (With Special Price) ---
    {
      type: 'row', // Places fields side-by-side in the admin panel
      fields: [
        {
          name: 'price',
          type: 'number',
          required: true,
          admin: { description: 'Base price in UAH' },
        },
        {
          name: 'specialPrice',
          type: 'number',
          admin: { description: 'Promotional sale price in UAH (Optional)' },
        },
      ],
    },

    // --- 3. STOCK STATUS FIELD ---
    {
      name: 'stockStatus',
      type: 'select',
      required: true,
      defaultValue: 'in_stock',
      options: [
        { label: 'Є в наявності', value: 'in_stock' },
        { label: 'Немає в наявності', value: 'out_stock' },
        { label: 'Попереднє замовлення', value: 'presell' },
      ],
    },
    {
      name: 'stock',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        // No need to track exact stock quantities for virtual products
        condition: (data) => data?.productType !== 'virtual',
      },
    },

    // --- 2. ASSIGNABLE ATTRIBUTES (e.g., Bookcover) ---
    {
      name: 'attributes',
      type: 'relationship',
      relationTo: 'attributes',
      hasMany: true,
      admin: {
        description: 'Select global book attributes (e.g., Cover Type, Language)',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'short-description',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              label: 'Short Description',
              required: false,
            },
            {
              name: 'description',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              label: 'Description',
              required: false,
            },
            {
              name: 'gallery',
              type: 'array',
              minRows: 1,
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'variantOption',
                  type: 'relationship',
                  relationTo: 'variantOptions',
                  admin: {
                    condition: (data) => {
                      return data?.enableVariants === true && data?.variantTypes?.length > 0
                    },
                  },
                  filterOptions: ({ data }) => {
                    if (data?.enableVariants && data?.variantTypes?.length) {
                      const variantTypeIDs = data.variantTypes.map((item: any) => {
                        if (typeof item === 'object' && item?.id) {
                          return item.id
                        }
                        return item
                      }) as DefaultDocumentIDType[]

                      if (variantTypeIDs.length === 0)
                        return {
                          variantType: {
                            in: [],
                          },
                        }

                      const query: Where = {
                        variantType: {
                          in: variantTypeIDs,
                        },
                      }

                      return query
                    }

                    return {
                      variantType: {
                        in: [],
                      },
                    }
                  },
                },
              ],
            },

            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction, Content, MediaBlock, ImageText],
            },
          ],
          label: 'Content',
        },
        {
          fields: [
            {
              name: 'relatedProducts',
              type: 'relationship',
              filterOptions: ({ id }) => {
                if (id) {
                  return {
                    id: {
                      not_in: [id],
                    },
                  }
                }

                // ID comes back as undefined during seeding so we need to handle that case
                return {
                  id: {
                    exists: true,
                  },
                }
              },
              hasMany: true,
              relationTo: 'products',
            },
          ],
          label: 'Related Products',
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
    {
      name: 'categories',
      type: 'relationship',
      admin: {
        position: 'sidebar',
        sortOptions: 'title',
      },
      hasMany: true,
      relationTo: 'categories',
    },
    slugField(),
  ],
})
