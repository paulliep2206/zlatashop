import type { Metadata } from 'next'

import { Grid } from '@/components/Grid'
import { ProductGridItem } from '@/components/ProductGridItem'
import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

type Args = {
  params: Promise<{
    slug: string
  }>
}

async function getCategoryWithDescendants(slug: string) {
  const payload = await getPayload({ config: configPromise })

  const categoryResult = await payload.find({
    collection: 'categories',
    limit: 1,
    overrideAccess: false,
    pagination: false,
    select: {
      id: true,
      slug: true,
      title: true,
    },
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  const category = categoryResult.docs?.[0]

  if (!category) {
    return null
  }

  const allCategories = await payload.find({
    collection: 'categories',
    overrideAccess: false,
    pagination: false,
    select: {
      id: true,
      parent: true,
    },
  })

  const childrenMap = new Map<number, number[]>()

  allCategories.docs.forEach((item) => {
    if (item.parent) {
      const parentId = typeof item.parent === 'number' ? item.parent : item.parent.id
      const currentChildren = childrenMap.get(parentId) || []
      currentChildren.push(item.id)
      childrenMap.set(parentId, currentChildren)
    }
  })

  const categoryIds = new Set<number>([category.id])
  const stack = [category.id]

  while (stack.length) {
    const currentId = stack.pop()

    if (!currentId) {
      continue
    }

    const children = childrenMap.get(currentId) || []

    children.forEach((childId) => {
      if (!categoryIds.has(childId)) {
        categoryIds.add(childId)
        stack.push(childId)
      }
    })
  }

  return {
    category,
    categoryIds: Array.from(categoryIds),
  }
}

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const categories = await payload.find({
    collection: 'categories',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return categories.docs.map(({ slug }) => ({ slug }))
}

export default async function CategoryPage({ params }: Args) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const categoryData = await getCategoryWithDescendants(slug)

  if (!categoryData) {
    return notFound()
  }

  const { category, categoryIds } = categoryData

  const products = await payload.find({
    collection: 'products',
    draft: false,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      gallery: true,
      categories: true,
      price: true,
      specialPrice: true,
      productType: true,
      variants: true,
      author: true,
    },
    sort: 'title',
    where: {
      and: [
        {
          _status: {
            equals: 'published',
          },
        },
        {
          categories: {
            in: categoryIds,
          },
        },
      ],
    },
  })

  console.log(products)
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{category.title}</h1>
      </div>

      {products.docs.length > 0 ? (
        <Grid className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.docs.map((product) => (
            <ProductGridItem key={product.id} product={product} />
          ))}
        </Grid>
      ) : (
        <p className="text-muted-foreground">No products found in this category yet.</p>
      )}
    </div>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const categoryData = await getCategoryWithDescendants(slug)

  return {
    title: categoryData?.category.title || 'Category',
    description: `Products in ${categoryData?.category.title || 'this category'}`,
  }
}
