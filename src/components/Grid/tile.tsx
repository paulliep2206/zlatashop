import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import clsx from 'clsx'
import React from 'react'

type Props = {
  active?: boolean
  isInteractive?: boolean
  label?: {
    amount: number
    position?: 'bottom' | 'center'
    title: string
  }
  media: MediaType
  /** `sizes` for the image, matching the caller's layout (defaults to `100vw`). */
  sizes?: string
}

export const GridTileImage: React.FC<Props> = ({
  isInteractive = true,
  label,
  sizes,
  ...props
}) => {
  return (
    <div className="group h-full w-full overflow-hidden">
      {props.media ? (
        <Media
          className={clsx('relative h-full w-full object-cover', {
            'transition duration-300 ease-in-out group-hover:scale-105': isInteractive,
          })}
          // width/height only set the intrinsic aspect ratio; the rendered size comes from CSS and
          // the downloaded size from `size`.
          height={80}
          imgClassName="h-full w-full object-cover"
          resource={props.media}
          size={sizes}
          width={80}
        />
      ) : null}
    </div>
  )
}
