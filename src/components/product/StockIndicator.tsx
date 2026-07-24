'use client'
import { Product } from '@/payload-types'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

type Props = {
  product: Product
}

export const StockIndicator: React.FC<Props> = ({ product }) => {
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

  const stockQuantity = useMemo(() => {
    if (hasVariants) {
      if (selectedVariant) {
        return selectedVariant.stock || 0
      }
    }
    return product.stock || 0
  }, [hasVariants, selectedVariant, product.stock])

  if (hasVariants && !selectedVariant) {
    return null
  }

  return (
    <div className="uppercase font-mono text-sm font-medium text-gray-500">
      {stockQuantity < 10 && stockQuantity > 0 && <p>Залишилося {stockQuantity} екземплярів</p>}
      {(stockQuantity === 0 || !stockQuantity) && <p>Немає в наявності</p>}
    </div>
  )
}
