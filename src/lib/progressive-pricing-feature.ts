const ENABLED_VALUE = 'true'

export function isProgressivePricingWritesEnabled() {
  const configuredValue = process.env.PROGRESSIVE_PRICING_WRITES_ENABLED
  return typeof configuredValue === 'string'
    && configuredValue.trim().toLowerCase() === ENABLED_VALUE
}
