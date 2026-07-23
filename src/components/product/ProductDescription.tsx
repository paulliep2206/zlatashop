'use client'
import type { Product } from '@/payload-types'

import { AddToCart } from '@/components/Cart/AddToCart'
import { SpecialPrice } from '@/components/Price'
import { RichText } from '@/components/RichText'
import { Suspense } from 'react'

import { StockIndicator } from '@/components/product/StockIndicator'
import { VariantSelector } from './VariantSelector'

export function ProductDescription({ product }: { product: Product }) {
  const hasVariants = product.productType === 'configurable' && Boolean(product.variants?.length)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-medium">{product.title}</h1>
        <div className="uppercase font-mono">
          {hasVariants ? (
            <SpecialPrice
              price={product.price}
              specialPrice={product.specialPrice ?? undefined}
              currencyCode="UAH"
            />
          ) : (
            <SpecialPrice
              price={product.price}
              specialPrice={product.specialPrice ?? undefined}
              currencyCode="UAH"
            />
          )}
        </div>
      </div>
      {product['short-description'] ? (
        <RichText className="m-0" data={product['short-description']} enableGutter={false} />
      ) : null}
      <hr />
      {hasVariants && (
        <>
          <Suspense fallback={null}>
            <VariantSelector product={product} />
          </Suspense>

          <hr />
        </>
      )}
      <div className="flex items-center justify-between">
        <Suspense fallback={null}>
          <StockIndicator product={product} />
        </Suspense>
      </div>

      <div className="flex items-center justify-between">
        <Suspense fallback={null}>
          <AddToCart product={product} />
        </Suspense>
      </div>
    </div>
  )
}
