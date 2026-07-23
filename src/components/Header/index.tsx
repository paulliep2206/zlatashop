import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getCachedGlobal } from '@/utilities/getGlobals'

import { HeaderClient } from './index.client'
import './index.css'
import type { CategoryNavItem } from './types'

async function getCategoryNav(): Promise<CategoryNavItem[]> {
  const payload = await getPayload({ config: configPromise })
  const categoriesData = await payload.find({
    collection: 'categories',
    sort: 'title',
    depth: 0,
    select: {
      id: true,
      title: true,
      slug: true,
      parent: true,
    },
  })

  const categoryMap = new Map<number, CategoryNavItem>()
  const topLevelCategories: CategoryNavItem[] = []

  const docs = categoriesData.docs as Array<{
    id: number
    title: string
    slug: string
    parent?: number | null
  }>

  docs.forEach((category) => {
    const item: CategoryNavItem = {
      id: category.id,
      title: category.title,
      slug: category.slug,
      children: [],
    }

    categoryMap.set(item.id, item)
  })

  docs.forEach((category) => {
    const item = categoryMap.get(category.id)

    if (!item) {
      return
    }

    if (category.parent && categoryMap.has(category.parent)) {
      categoryMap.get(category.parent)?.children.push(item)
    } else {
      topLevelCategories.push(item)
    }
  })

  topLevelCategories.sort((a, b) => a.title.localeCompare(b.title))
  topLevelCategories.forEach((category) => {
    category.children.sort((a, b) => a.title.localeCompare(b.title))
  })

  return topLevelCategories
}

export async function Header() {
  const header = await getCachedGlobal('header', 1)()
  const categories = await getCategoryNav()

  return <HeaderClient header={header} categories={categories} />
}
