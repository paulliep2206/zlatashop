import type { Footer } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import React from 'react'

interface Props {
  menu: Footer['navItems']
}

export function FooterMenu({ menu }: Props) {
  if (!menu?.length) return null

  return (
    <nav aria-label="Навігація у футері">
      <ul className="flex flex-col gap-2">
        {menu.map((item) => {
          return (
            <li key={item.id ?? `${item.link.type}-${item.link.url}-${item.link.label}`}>
              <CMSLink
                appearance="inline"
                className="transition-colors hover:text-black dark:hover:text-white"
                {...item.link}
              />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
