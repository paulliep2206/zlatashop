'use client'

import type { Header } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/providers/Auth'
import { getCategoryPath } from '@/utilities/getCategoryPath'
import { ChevronRight, MenuIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { CategoryNavItem } from './types'

interface Props {
  menu: Header['navItems']
  categories: CategoryNavItem[]
}

export function MobileMenu({ menu, categories }: Props) {
  const { user } = useAuth()

  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [openCategoryId, setOpenCategoryId] = useState<number | null>(null)

  const closeMobileMenu = () => setIsOpen(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname, searchParams])

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger className="relative flex items-center justify-center mt-2">
        <MenuIcon size="40px" />
      </SheetTrigger>

      <SheetContent side="left" className="px-4">
        <SheetHeader className="px-0 pt-4 pb-0">
          <SheetTitle>My Store</SheetTitle>

          <SheetDescription />
        </SheetHeader>

        <div className="py-4">
          {menu?.length ? (
            <ul className="flex w-full flex-col">
              {menu.map((item) => (
                <li className="py-2" key={item.id}>
                  <CMSLink {...item.link} appearance="link" />
                </li>
              ))}
            </ul>
          ) : null}

          {categories.length ? (
            <div className="mt-4 border-t border-border pt-4">
              <h2 className="mb-3 font-heading text-sm uppercase tracking-[0.2em]">Categories</h2>
              <ul className="flex w-full flex-col gap-2">
                {categories.map((category) => {
                  const isOpen = openCategoryId === category.id

                  return (
                    <li key={category.id}>
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={getCategoryPath(category.slug)}
                          className="font-heading flex-1 text-sm uppercase tracking-[0.16em]"
                          onClick={closeMobileMenu}
                        >
                          {category.title}
                        </Link>
                        {category.children.length ? (
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            className="rounded p-1"
                            onClick={() =>
                              setOpenCategoryId((current) =>
                                current === category.id ? null : category.id,
                              )
                            }
                          >
                            <ChevronRight
                              className={
                                isOpen ? 'rotate-90 transition-transform' : 'transition-transform'
                              }
                              size={16}
                            />
                          </button>
                        ) : null}
                      </div>

                      {isOpen && category.children.length ? (
                        <ul className="mt-2 flex flex-col gap-2 pl-4">
                          {category.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={getCategoryPath(child.slug)}
                                className="font-heading text-sm uppercase tracking-[0.14em]"
                                onClick={closeMobileMenu}
                              >
                                {child.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>

        {user ? (
          <div className="mt-4">
            <h2 className="text-xl mb-4">My account</h2>
            <hr className="my-2" />
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/orders">Orders</Link>
              </li>
              <li>
                <Link href="/account/addresses">Addresses</Link>
              </li>
              <li>
                <Link href="/account">Manage account</Link>
              </li>
              <li className="mt-6">
                <Button asChild variant="outline">
                  <Link href="/logout">Log out</Link>
                </Button>
              </li>
            </ul>
          </div>
        ) : (
          <div>
            <h2 className="text-xl mb-4">My account</h2>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild className="w-full sm:flex-1" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
              <span className="text-center text-sm text-muted-foreground sm:text-base">or</span>
              <Button asChild className="w-full sm:flex-1">
                <Link href="/create-account">Create an account</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
