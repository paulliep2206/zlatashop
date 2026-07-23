import type { Product } from '@/payload-types'

import { AddToCart } from '@/components/Cart/AddToCart'
import { Media } from '@/components/Media'
import { SpecialPrice } from '@/components/Price'
import clsx from 'clsx'
import Link from 'next/link'
import React from 'react'

type Props = {
  product: Partial<Product>
}

export const ProductGridItem: React.FC<Props> = ({ product }) => {
  const { gallery, price, specialPrice, author, title } = product

  const isSimpleProduct = product.productType === 'simple'
  console.log('product', product)

  const image =
    gallery?.[0]?.image && typeof gallery[0]?.image !== 'string' ? gallery[0]?.image : false

  return (
    <div className="relative flex h-full w-full flex-col group border border-1 border-white">
      <Link className="flex-1" href={`/products/${product.slug}`}>
        {image ? (
          <Media
            className={clsx('relative aspect-square object-cover')}
            height={80}
            imgClassName={clsx('h-full w-full object-cover', {
              'transition duration-300 ease-in-out group-hover:scale-102': true,
            })}
            resource={image}
            width={80}
          />
        ) : null}
      </Link>

      <div className="font-heading p-8">
        <Link className="flex-1" href={`/products/${product.slug}`}>
          <div className="font-bold text-xl ">{title}</div>
        </Link>
        {author && <div className="text-sm">{author}</div>}
        <div className="flex justify-between items-center">
          {(product.price || product.specialPrice) && (
            <div className="mt-4">
              <SpecialPrice price={price ?? 0} specialPrice={specialPrice ?? 0} />
            </div>
          )}
          <div className="mt-4">
            {isSimpleProduct ? (
              <AddToCart product={product as Product} showText={false} />
            ) : (
              <Link href={`/products/${product.slug}`}>Детальніше</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
