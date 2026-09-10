import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'

import { Page, Product } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { ProductsCollection } from '@/collections/Products'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isDocumentOwner } from '@/access/isDocumentOwner'
import { uploadthingStorage } from '@payloadcms/storage-uploadthing'
import { calculateCartSubtotal } from '@/lib/pricing'
import { UAH_CURRENCIES_CONFIG } from '@/lib/currency'

const generateTitle: GenerateTitle<Product | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Payload Ecommerce Template` : 'Payload Ecommerce Template'
}

const generateURL: GenerateURL<Product | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        group: 'Content',
      },
    },
    formOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
        create: isAdmin,
      },
      admin: {
        group: 'Content',
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
      isAdmin,
      isDocumentOwner,
    },
    customers: {
      slug: 'users',
    },
    currencies: UAH_CURRENCIES_CONFIG,
    carts: {
      cartsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        hooks: {
          ...defaultCollection.hooks,
          afterRead: [
            ...(defaultCollection.hooks?.afterRead ?? []),
            async ({ doc, req }) => {
              if (!Array.isArray(doc.items)) return doc

              doc.subtotal = await calculateCartSubtotal(doc.items, (id) =>
                req.payload.findByID({
                  collection: 'products',
                  id,
                  depth: 0,
                  select: {
                    price: true,
                    specialPrice: true,
                  },
                }),
              )

              return doc
            },
          ],
          beforeChange: [
            ...(defaultCollection.hooks?.beforeChange ?? []),
            async ({ data, req }) => {
              if (!Array.isArray(data.items)) return data

              data.subtotal = await calculateCartSubtotal(data.items, (id) =>
                req.payload.findByID({
                  collection: 'products',
                  id,
                  depth: 0,
                  select: {
                    price: true,
                    specialPrice: true,
                  },
                }),
              )

              return data
            },
          ],
        },
      }),
    },
    addresses: {
      addressFields: ({ defaultFields }) => [
        ...defaultFields,
        {
          name: 'fatherName',
          type: 'text',
          label: 'Father name',
        },
      ],
    },
    orders: {
      ordersCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        fields: [
          ...defaultCollection.fields,
          {
            name: 'accessToken',
            type: 'text',
            unique: true,
            index: true,
            admin: {
              position: 'sidebar',
              readOnly: true,
            },
            hooks: {
              beforeValidate: [
                ({ value, operation }) => {
                  if (operation === 'create' || !value) {
                    return crypto.randomUUID()
                  }
                  return value
                },
              ],
            },
          },
          {
            name: 'novaPoshtaShipping',
            type: 'json',
            admin: {
              description: 'Selected Nova Poshta office and automatic electronic waybill status.',
              readOnly: true,
            },
            label: 'Nova Poshta shipping',
          },
        ],
      }),
    },
    products: {
      productsCollectionOverride: ProductsCollection,
      // The cart hooks above validate and calculate from the custom UAH price fields.
      // Payload's default validator only understands generated priceIn{currency} fields.
      validation: () => undefined,
      variants: false,
    },
  }),
  uploadthingStorage({
    collections: {
      // 'media' matches the slug property defined inside your Media.ts file
      media: true,
    },
    options: {
      // Pulls the long UMS_... key securely from your secret env profile
      token: process.env.UPLOADTHING_TOKEN || '',
      acl: 'public-read',
    },
  }),
]
