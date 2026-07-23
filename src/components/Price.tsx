'use client'
import { cn } from '@/utilities/cn'
import React from 'react'

type BaseProps = {
  className?: string
  currencyCodeClassName?: string
  as?: 'span' | 'p'
}

type PriceFixed = {
  amount: number
  currencyCode?: string
  highestAmount?: never
  lowestAmount?: never
}

type PriceRange = {
  amount?: never
  currencyCode?: string
  highestAmount: number
  lowestAmount: number
}

type Props = BaseProps & (PriceFixed | PriceRange)

type SpecialPriceProps = BaseProps & {
  price: number
  specialPrice?: number
  currencyCode?: string
  as?: 'span' | 'p'
}

const formatUah = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return ''
  }

  return `${new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} грн`
}

export const Price = ({
  amount,
  className,
  highestAmount,
  lowestAmount,
  currencyCode: currencyCodeFromProps,
  as = 'p',
}: Props & React.ComponentProps<'p'>) => {
  const Element = as

  if (typeof amount === 'number') {
    return (
      <Element className={className} suppressHydrationWarning>
        {formatUah(amount)}
      </Element>
    )
  }

  if (highestAmount && highestAmount !== lowestAmount) {
    return (
      <Element className={className} suppressHydrationWarning>
        {`${formatUah(lowestAmount)} - ${formatUah(highestAmount)}`}
      </Element>
    )
  }

  if (lowestAmount) {
    return (
      <Element className={className} suppressHydrationWarning>
        {formatUah(lowestAmount)}
      </Element>
    )
  }

  return null
}

export const SpecialPrice = ({
  price,
  specialPrice,
  className,
  currencyCode: currencyCodeFromProps,
  as = 'p',
}: SpecialPriceProps & React.ComponentProps<'p'>) => {
  const Element = as

  const formattedPrice = formatUah(price)
  const formattedSpecialPrice = specialPrice ? formatUah(specialPrice) : null

  if (formattedSpecialPrice) {
    return (
      <Element className={className} suppressHydrationWarning>
        <span className="block font-semibold">{formattedSpecialPrice}</span>
        <span className="mt-1 block text-sm font-medium text-muted-foreground line-through">
          {formattedPrice}
        </span>
      </Element>
    )
  }

  return (
    <Element className={cn('font-semibold', className)} suppressHydrationWarning>
      {formattedPrice}
    </Element>
  )
}
