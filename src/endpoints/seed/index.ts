import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest, File } from 'payload'

import { contactFormData } from './contact-form'
import { contactPageData } from './contact-page'
import { homePageData } from './home'
import { imageHatData } from './image-hat'
import { imageTshirtBlackData } from './image-tshirt-black'
import { imageTshirtWhiteData } from './image-tshirt-white'
import { imageHero1Data } from './image-hero-1'
import { Address } from '@/payload-types'

const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'products',
  'forms',
  'form-submissions',
  'carts',
  'addresses',
  'orders',
]

const categories = ['Accessories', 'T-Shirts', 'Hats']

const globals: GlobalSlug[] = ['header', 'footer']

const baseAddressUSData: Partial<Address> = {
  title: 'Dr.',
  firstName: 'Otto',
  lastName: 'Octavius',
  phone: '1234567890',
  company: 'Oscorp',
  addressLine1: '123 Main St',
  addressLine2: 'Suite 100',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'US',
}

const baseAddressUKData: Partial<Address> = {
  title: 'Mr.',
  firstName: 'Oliver',
  lastName: 'Twist',
  phone: '1234567890',
  addressLine1: '48 Great Portland St',
  city: 'London',
  postalCode: 'W1W 7ND',
  country: 'GB',
}

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. running `yarn seed` locally instead of using the admin UI within an active app
// The app is not running to revalidate the pages and so the API routes are not available
// These error messages can be ignored: `Error hitting revalidate route for...`
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database...')

  // we need to clear the media directory before seeding
  // as well as the collections and globals
  // this is because while `yarn seed` drops the database
  // the custom `/api/seed` endpoint does not
  payload.logger.info(`— Clearing collections and globals...`)

  // clear the database
  await Promise.all(
    globals.map((global) =>
      payload.updateGlobal({
        slug: global,
        data: {
          navItems: [],
        },
        depth: 0,
        context: {
          disableRevalidate: true,
        },
      }),
    ),
  )

  for (const collection of collections) {
    await payload.db.deleteMany({ collection, req, where: {} })
    if (payload.collections[collection].config.versions) {
      await payload.db.deleteVersions({ collection, req, where: {} })
    }
  }

  payload.logger.info(`— Seeding customer and customer data...`)

  await payload.delete({
    collection: 'users',
    depth: 0,
    where: {
      email: {
        equals: 'customer@example.com',
      },
    },
  })

  payload.logger.info(`— Seeding media...`)

  const [imageHatBuffer, imageTshirtBlackBuffer, imageTshirtWhiteBuffer, heroBuffer] =
    await Promise.all([
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/hat-logo.png',
      ),
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/tshirt-black.png',
      ),
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/tshirt-white.png',
      ),
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/website/src/endpoints/seed/image-hero1.webp',
      ),
    ])

  const [
    customer,
    imageHat,
    imageTshirtBlack,
    imageTshirtWhite,
    imageHero,
    accessoriesCategory,
    tshirtsCategory,
    hatsCategory,
  ] = await Promise.all([
    payload.create({
      collection: 'users',
      data: {
        name: 'Customer',
        email: 'customer@example.com',
        password: 'password',
        roles: ['customer'],
      },
    }),
    payload.create({
      collection: 'media',
      data: imageHatData,
      file: imageHatBuffer,
    }),
    payload.create({
      collection: 'media',
      data: imageTshirtBlackData,
      file: imageTshirtBlackBuffer,
    }),
    payload.create({
      collection: 'media',
      data: imageTshirtWhiteData,
      file: imageTshirtWhiteBuffer,
    }),
    payload.create({
      collection: 'media',
      data: imageHero1Data,
      file: heroBuffer,
    }),
    ...categories.map((category) =>
      payload.create({
        collection: 'categories',
        data: {
          title: category,
          slug: category,
        },
      }),
    ),
  ])

  payload.logger.info(`— Seeding products...`)

  const productHat = await payload.create({
    collection: 'products',
    depth: 0,
    data: {
      title: 'Hat',
      slug: 'hat',
      sku: 'hat',
      productType: 'simple',
      price: 2500,
      stockStatus: 'in_stock',
      stock: 100,
      gallery: [{ image: imageHat.id }],
      categories: [hatsCategory.id],
      _status: 'published',
    },
  })

  const [blackTshirt, whiteTshirt] = await Promise.all([
    payload.create({
      collection: 'products',
      depth: 0,
      data: {
        title: 'T-Shirt — Black',
        slug: 'tshirt-black',
        sku: 'tshirt-black',
        productType: 'simple',
        price: 4999,
        stockStatus: 'in_stock',
        stock: 50,
        gallery: [{ image: imageTshirtBlack.id }],
        categories: [tshirtsCategory.id],
        _status: 'published',
      },
    }),
    payload.create({
      collection: 'products',
      depth: 0,
      data: {
        title: 'T-Shirt — White',
        slug: 'tshirt-white',
        sku: 'tshirt-white',
        productType: 'simple',
        price: 4999,
        stockStatus: 'in_stock',
        stock: 50,
        gallery: [{ image: imageTshirtWhite.id }],
        categories: [tshirtsCategory.id],
        _status: 'published',
      },
    }),
  ])

  const productTshirt = await payload.create({
    collection: 'products',
    depth: 0,
    data: {
      title: 'T-Shirt',
      slug: 'tshirt',
      sku: 'tshirt',
      productType: 'configurable',
      variants: [blackTshirt.id, whiteTshirt.id],
      price: 4999,
      stockStatus: 'in_stock',
      stock: 0,
      gallery: [{ image: imageTshirtBlack.id }, { image: imageTshirtWhite.id }],
      categories: [tshirtsCategory.id],
      _status: 'published',
    },
  })

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData(),
  })

  payload.logger.info(`— Seeding pages...`)

  const [_, contactPage] = await Promise.all([
    payload.create({
      collection: 'pages',
      depth: 0,
      data: homePageData({
        contentImage: imageHero,
        metaImage: imageHat,
      }),
    }),
    payload.create({
      collection: 'pages',
      depth: 0,
      data: contactPageData({
        contactForm: contactForm,
      }),
    }),
  ])

  payload.logger.info(`— Seeding addresses...`)

  const customerUSAddress = await payload.create({
    collection: 'addresses',
    depth: 0,
    data: {
      customer: customer.id,
      ...(baseAddressUSData as Address),
    },
  })

  const customerUKAddress = await payload.create({
    collection: 'addresses',
    depth: 0,
    data: {
      customer: customer.id,
      ...(baseAddressUKData as Address),
    },
  })

  payload.logger.info(`— Seeding carts...`)

  // This cart is open as it's created now
  const openCart = await payload.create({
    collection: 'carts',
    data: {
      customer: customer.id,
      currency: 'UAH',
      items: [
        {
          product: blackTshirt.id,
          quantity: 1,
        },
      ],
    },
  })

  const oldTimestamp = new Date('2023-01-01T00:00:00Z').toISOString()

  // Cart is abandoned because it was created long in the past
  const abandonedCart = await payload.create({
    collection: 'carts',
    data: {
      currency: 'UAH',
      createdAt: oldTimestamp,
      items: [
        {
          product: productHat.id,
          quantity: 1,
        },
      ],
    },
  })

  // Cart is purchased because it has a purchasedAt date
  const completedCart = await payload.create({
    collection: 'carts',
    data: {
      customer: customer.id,
      currency: 'UAH',
      purchasedAt: new Date().toISOString(),
      subtotal: 7499,
      items: [
        {
          product: blackTshirt.id,
          quantity: 1,
        },
        {
          product: whiteTshirt.id,
          quantity: 1,
        },
      ],
    },
  })

  let completedCartID: number | string = completedCart.id

  if (payload.db.defaultIDType === 'text') {
    completedCartID = `"${completedCartID}"`
  }

  payload.logger.info(`— Seeding orders...`)

  const orderInCompleted = await payload.create({
    collection: 'orders',
    data: {
      amount: 7499,
      currency: 'UAH',
      customer: customer.id,
      shippingAddress: baseAddressUSData,
      items: [
        {
          product: blackTshirt.id,
          quantity: 1,
        },
        {
          product: whiteTshirt.id,
          quantity: 1,
        },
      ],
      status: 'completed',
    },
  })

  const orderInProcessing = await payload.create({
    collection: 'orders',
    data: {
      amount: 7499,
      currency: 'UAH',
      customer: customer.id,
      shippingAddress: baseAddressUSData,
      items: [
        {
          product: blackTshirt.id,
          quantity: 1,
        },
        {
          product: whiteTshirt.id,
          quantity: 1,
        },
      ],
      status: 'processing',
    },
  })

  payload.logger.info(`— Seeding globals...`)

  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Home',
              url: '/',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Shop',
              url: '/shop',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Account',
              url: '/account',
            },
          },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Магазин',
              url: '/shop',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Особистий кабінет',
              url: '/account',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Знайти замовлення',
              url: '/find-order',
            },
          },
        ],
      },
    }),
  ])

  payload.logger.info('Seeded database successfully!')
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }

  const data = await res.arrayBuffer()

  return {
    name: url.split('/').pop() || `file-${Date.now()}`,
    data: Buffer.from(data),
    mimetype: `image/${url.split('.').pop()}`,
    size: data.byteLength,
  }
}
