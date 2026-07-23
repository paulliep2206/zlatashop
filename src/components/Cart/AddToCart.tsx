'use client'

import { Button } from '@/components/ui/button'
import type { Product } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import clsx from 'clsx'
import { ShoppingCart } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
type Props = {
  product: Product
  showText?: boolean
  className?: string
}

export function AddToCart({ product, showText = true, className }: Props) {
  const { addItem, cart, isLoading } = useCart()
  const searchParams = useSearchParams()

  const variants = product.variants || []
  const hasVariants = product.productType === 'configurable' && variants.length > 0

  const selectedVariant = useMemo<Product | undefined>(() => {
    if (hasVariants) {
      const variantId = searchParams.get('variant')

      const validVariant = variants.find((variant) => {
        if (typeof variant === 'object') {
          return String(variant.id) === variantId
        }
        return String(variant) === variantId
      })

      if (validVariant && typeof validVariant === 'object') {
        return validVariant
      }
    }

    return undefined
  }, [hasVariants, searchParams, variants])

  const addToCart = useCallback(
    (e: React.FormEvent<HTMLButtonElement>) => {
      e.preventDefault()

      addItem({
        product: selectedVariant?.id ?? product.id,
      }).then(() => {
        toast.success('Item added to cart.')
      })
    },
    [addItem, product, selectedVariant],
  )

  const disabled = useMemo<boolean>(() => {
    const existingItem = cart?.items?.find((item) => {
      const productID = typeof item.product === 'object' ? item.product?.id : item.product
      const cartProductID = selectedVariant?.id ?? product.id

      return productID === cartProductID
    })

    if (existingItem) {
      const existingQuantity = existingItem.quantity

      return existingQuantity >= (selectedVariant?.stock ?? product.stock ?? 0)
    }

    if (hasVariants) {
      if (!selectedVariant) {
        return true
      }

      if (selectedVariant.stockStatus === 'out_stock' || selectedVariant.stock === 0) {
        return true
      }
    } else {
      if (product.stockStatus === 'out_stock' || product.stock === 0) {
        return true
      }
    }

    return false
  }, [selectedVariant, cart?.items, product])

  return (
    <Button
      aria-label="Add to cart"
      variant={'default'}
      size={showText ? 'default' : 'icon'}
      className={clsx(
        {
          'hover:opacity-90': true,
          'rounded-0 size-10': !showText,
        },
        className,
      )}
      disabled={disabled || isLoading}
      onClick={addToCart}
      type="submit"
      title="Add to cart"
    >
      <ShoppingCart className={showText ? 'size-4' : 'size-5'} />
      {showText ? 'Додати в кошик' : null}
    </Button>
  )
}
