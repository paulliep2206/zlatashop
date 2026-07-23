'use client'
import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import { CMSLink } from '@/components/Link'
import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'

import { cn } from '@/utilities/cn'
import { getCategoryPath } from '@/utilities/getCategoryPath'
import { usePathname, useSearchParams } from 'next/navigation'
import type { Header } from 'src/payload-types'
import { MobileMenu } from './MobileMenu'
import type { CategoryNavItem } from './types'

type Props = {
  header: Header
  categories: CategoryNavItem[]
}

export function HeaderClient({ header, categories }: Props) {
  const menu = header.navItems || []
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openCategoryId, setOpenCategoryId] = useState<number | null>(null)
  const categoryMenuRef = useRef<HTMLDivElement>(null)

  const segments = pathname.split('/').filter(Boolean)
  const activeCategorySlug =
    searchParams.get('category') ?? (segments[0] === 'category' ? segments[1] : null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setOpenCategoryId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    setOpenCategoryId(null)
  }, [pathname, searchParams])

  return (
    <header className="relative z-20">
      <div className="container flex items-center justify-between py-6 md:items-end border-b border-white">
        <div className="flex flex-1 items-center justify-start">
          <div className="block flex-none md:hidden">
            <Suspense fallback={null}>
              <MobileMenu menu={menu} categories={categories} />
            </Suspense>
          </div>
        </div>

        <div className="flex flex-1 justify-center">
          <Link className="flex items-center justify-center pb-4 pt-4" href="/">
            <span className="font-logo text-2xl md:text-4xl">Злата Соловей</span>
          </Link>
        </div>

        <div className="flex flex-1 justify-end">
          <Suspense fallback={<OpenCartButton />}>
            <Cart />
          </Suspense>
        </div>
      </div>
      <nav className="container hidden border-b border-border/60 bg-background/95 md:flex md:items-center md:justify-start">
        {categories.length ? (
          <div className="border-t border-border/60 bg-background/95" ref={categoryMenuRef}>
            <div className="container py-3">
              <ul className="hidden items-center gap-5 md:flex">
                {categories.map((category) => {
                  const isActive = activeCategorySlug === category.slug
                  const isOpen = openCategoryId === category.id

                  return (
                    <li className="relative" key={category.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCategoryId((current) =>
                            current === category.id ? null : category.id,
                          )
                        }}
                        className={cn(
                          'font-heading text-sm uppercase tracking-[0.2em] transition-colors hover:text-primary cursor-pointer',
                          {
                            'text-primary': isActive || isOpen,
                          },
                        )}
                      >
                        {category.title}
                      </button>

                      {category.children.length && isOpen ? (
                        <div className="absolute left-0 top-full z-30 mt-2 min-w-[220px] rounded-md border border-border bg-background p-3 shadow-lg">
                          <ul className="flex flex-col gap-2">
                            {category.children.map((child) => (
                              <li key={child.id}>
                                <Link
                                  href={getCategoryPath(child.slug)}
                                  className={cn(
                                    'font-heading block text-sm uppercase tracking-[0.16em] transition-colors hover:text-primary',
                                    {
                                      'text-primary': activeCategorySlug === child.slug,
                                    },
                                  )}
                                >
                                  {child.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        ) : null}
        {menu.length ? (
          <ul className="hidden gap-4 text-sm md:flex md:items-center">
            {menu.map((item) => (
              <li key={item.id}>
                <CMSLink
                  {...item.link}
                  size={'clear'}
                  className={cn(
                    'relative navLink font-heading text-sm uppercase tracking-[0.2em] transition-colors hover:text-primary p-3',
                  )}
                  appearance="nav"
                />
              </li>
            ))}
          </ul>
        ) : null}
      </nav>
    </header>
  )
}
