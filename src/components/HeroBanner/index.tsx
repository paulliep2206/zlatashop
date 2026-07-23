import NextLink from 'next/link'
import React from 'react'

import { Media } from '@/components/Media'
import type { Media as MediaType, Page } from '@/payload-types'
import { cn } from '@/utilities/cn'

type BannerData = NonNullable<Page['hero-banner']>

type Props = {
  data: Page['hero-banner']
}

function resolveHref(linkConfig: BannerData['linkConfig']): string | null {
  if (!linkConfig) return null

  if (linkConfig.linkType === 'external') {
    return linkConfig.externalUrl || null
  }

  if (linkConfig.linkType === 'internal' && linkConfig.internalLink) {
    const link = linkConfig.internalLink
    if (link && typeof link.value === 'object' && link.value !== null) {
      const slug = (link.value as { slug?: string }).slug
      if (!slug) return null
      if (link.relationTo === 'pages') return `/${slug}`
      if (link.relationTo === 'products') return `/products/${slug}`
      if (link.relationTo === 'categories') return `/category/${slug}`
    }
  }

  return null
}

export const HeroBanner: React.FC<Props> = ({ data }) => {
  if (!data) return null

  const {
    showBanner,
    'Mobile image': mobileImage,
    'Desktop image': desktopImage,
    description,
    linkConfig,
  } = data

  const hasMobileImage = Boolean(mobileImage && typeof mobileImage === 'object')
  const hasDesktopImage = Boolean(desktopImage && typeof desktopImage === 'object')

  // Only render if at least one image is present and the banner is toggled on
  if (!showBanner || (!hasMobileImage && !hasDesktopImage)) return null

  const href = resolveHref(linkConfig)
  const buttonText = linkConfig?.buttonText

  const bannerBody = (
    <div className={cn('relative w-full overflow-hidden', href && 'group')}>
      {/* ── Responsive images ── */}
      {hasMobileImage && hasDesktopImage ? (
        <>
          {/* Mobile: show mobile image */}
          <div className="block md:hidden">
            <Media resource={mobileImage as MediaType} imgClassName="w-full h-auto" priority />
          </div>
          {/* Desktop: show desktop image */}
          <div className="hidden md:block">
            <Media resource={desktopImage as MediaType} imgClassName="w-full h-auto" priority />
          </div>
        </>
      ) : (
        /* Fallback: only one image — show it on all screen sizes */
        <Media
          resource={(hasMobileImage ? mobileImage : desktopImage) as MediaType}
          imgClassName="w-full h-auto"
          priority
        />
      )}

      {/* ── Text / action overlay ── */}
      {(description || href) && (
        <div
          className={cn(
            'absolute inset-0 z-10 flex flex-col justify-start',
            'p-5 md:p-10',
            // gradient only when there's text so the image stays clean when only a button is present
            description && 'bg-linear-to-b from-black/55 via-black/20 to-transparent',
          )}
        >
          {description && (
            <p className="text-white text-sm md:text-base font-medium max-w-xl drop-shadow">
              {description}
            </p>
          )}

          {href && buttonText && (
            <span
              className={cn(
                'mt-3 inline-flex w-fit items-center rounded-md px-4 py-2',
                'bg-white text-black text-sm font-semibold shadow',
                'transition-opacity',
                'group-hover:opacity-90',
              )}
            >
              {buttonText}
            </span>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div>
      {href ? (
        <NextLink href={href} className="block">
          {bannerBody}
        </NextLink>
      ) : (
        bannerBody
      )}
    </div>
  )
}
