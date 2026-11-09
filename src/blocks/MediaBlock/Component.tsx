import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/cn'
import React from 'react'
import { RichText } from '@/components/RichText'
import type { MediaBlock as MediaBlockProps } from '@/payload-types'

import { Media } from '../../components/Media'

export const MediaBlock: React.FC<
  MediaBlockProps & {
    id?: string | number
    breakout?: boolean
    captionClassName?: string
    className?: string
    enableGutter?: boolean
    imgClassName?: string
    /** `sizes` for the image; defaults to the page container width (never wider than it). */
    size?: string
    staticImage?: StaticImageData
    disableInnerContainer?: boolean
  }
> = (props) => {
  const {
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    media,
    size = '(min-width: 1376px) 1312px, 100vw',
    staticImage,
    disableInnerContainer,
  } = props

  let caption
  if (media && typeof media === 'object') caption = media.caption

  return (
    <div
      className={cn(
        '',
        {
          container: enableGutter,
        },
        className,
      )}
    >
      <Media
        imgClassName={cn('border border-border rounded-[0.8rem]', imgClassName)}
        resource={media}
        size={size}
        src={staticImage}
      />
      {caption && (
        <div
          className={cn(
            'mt-6',
            {
              container: !disableInnerContainer,
            },
            captionClassName,
          )}
        >
          <RichText data={caption} enableGutter={false} />
        </div>
      )}
    </div>
  )
}
