'use client'

import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/cn'
import NextImage from 'next/image'
import React from 'react'

import { IMAGE_QUALITY } from '../constants'
import type { Props as MediaProps } from '../types'

export const Image: React.FC<MediaProps> = (props) => {
  const {
    alt: altFromProps,
    fetchPriority,
    fill,
    height: heightFromProps,
    imgClassName,
    onClick,
    onLoad: onLoadFromProps,
    priority,
    resource,
    size: sizeFromProps,
    src: srcFromProps,
    width: widthFromProps,
  } = props

  const [isLoading, setIsLoading] = React.useState(true)

  let width: number | undefined | null
  let height: number | undefined | null
  let alt = altFromProps
  let src: StaticImageData | string = srcFromProps || ''

  if (!src && resource && typeof resource === 'object') {
    const { alt: altFromResource, height: fullHeight, url, width: fullWidth } = resource

    width = widthFromProps ?? fullWidth
    height = heightFromProps ?? fullHeight
    alt = altFromResource

    // Use url directly:
    //  - local storage  → relative path  (/api/media/file/…) → matched by next.config localPatterns
    //  - cloud storage  → absolute URL   (https://utfs.io/…)  → matched by next.config remotePatterns
    src = url || ''
  }

  // `sizes` tells the browser how wide the image is displayed, which picks the srcset entry to
  // download. Callers should pass `size` matching their CSS layout; `100vw` is the safe default
  // because it never asks for an image wider than the viewport.
  const sizes = sizeFromProps || '100vw'

  return (
    <NextImage
      alt={alt || ''}
      className={cn(imgClassName)}
      fetchPriority={fetchPriority}
      fill={fill}
      height={!fill ? height || heightFromProps : undefined}
      onClick={onClick}
      onLoad={() => {
        setIsLoading(false)
        if (typeof onLoadFromProps === 'function') {
          onLoadFromProps()
        }
      }}
      priority={priority}
      quality={IMAGE_QUALITY}
      sizes={sizes}
      src={src}
      width={!fill ? width || widthFromProps : undefined}
      loading={priority || fetchPriority === 'high' ? 'eager' : 'lazy'}
    />
  )
}
