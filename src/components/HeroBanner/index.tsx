import { getImageProps } from 'next/image'
import NextLink from 'next/link'
import React from 'react'

import { Media } from '@/components/Media'
import { IMAGE_QUALITY } from '@/components/Media/constants'
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

// Must match Tailwind's `md` breakpoint (48rem).
const DESKTOP_MEDIA = '(min-width: 768px)'
const HERO_SIZES = '100vw'

/** A media doc with everything `next/image` needs; without these `getImageProps` throws. */
type UsableImage = MediaType & { height: number; url: string; width: number }

function isUsableImage(media: unknown): media is UsableImage {
  if (typeof media !== 'object' || media === null) return false
  const { height, url, width } = media as MediaType
  return Boolean(url && width && height)
}

/**
 * Art-directed hero: one <picture> so the browser downloads only the image for the current
 * viewport (two CSS-hidden <img>s would download and preload both).
 */
function ArtDirectedHero({ desktop, mobile }: { desktop: UsableImage; mobile: UsableImage }) {
  const common = { alt: mobile.alt || '', quality: IMAGE_QUALITY, sizes: HERO_SIZES }

  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    height: desktop.height,
    src: desktop.url,
    width: desktop.width,
  })
  // imgProps carries alt, sizes, decoding="async", width/height and the fallback src.
  const {
    props: { srcSet: mobileSrcSet, ...imgProps },
  } = getImageProps({
    ...common,
    height: mobile.height,
    src: mobile.url,
    width: mobile.width,
  })

  return (
    <picture>
      <source
        height={desktop.height}
        media={DESKTOP_MEDIA}
        sizes={HERO_SIZES}
        srcSet={desktopSrcSet}
        width={desktop.width}
      />
      {/* eager + high priority override getImageProps' lazy default: this is the LCP image. */}
      <img
        {...imgProps}
        // Already in imgProps, but jsx-a11y/alt-text can't see through the spread.
        alt={imgProps.alt}
        className="w-full h-auto"
        fetchPriority="high"
        loading="eager"
        srcSet={mobileSrcSet}
      />
    </picture>
  )
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

  const mobile = isUsableImage(mobileImage) ? mobileImage : null
  const desktop = isUsableImage(desktopImage) ? desktopImage : null
  const singleImage = mobile ?? desktop

  // Only render if at least one usable image is present and the banner is toggled on
  if (!showBanner || !singleImage) return null

  const href = resolveHref(linkConfig)
  const buttonText = linkConfig?.buttonText

  const bannerBody = (
    <div className={cn('relative w-full overflow-hidden', href && 'group')}>
      {/* ── Responsive images ── */}
      {mobile && desktop ? (
        <ArtDirectedHero desktop={desktop} mobile={mobile} />
      ) : (
        /* Fallback: only one usable image — show it on all screen sizes */
        <Media resource={singleImage} imgClassName="w-full h-auto" priority size={HERO_SIZES} />
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
