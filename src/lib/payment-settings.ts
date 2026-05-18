export const PAYMENT_TRANSFER_SETTING_KEY = 'payment_transfer_settings'

export interface PaymentTransferSettings {
  bankName: string
  accountName: string
  accountNumber: string
  promptPay: string
  branchName: string
  instructions: string
}

export const EMPTY_PAYMENT_TRANSFER_SETTINGS: PaymentTransferSettings = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  promptPay: '',
  branchName: '',
  instructions: '',
}

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizePaymentTransferSettings(value: unknown): PaymentTransferSettings {
  if (!value || typeof value !== 'object') {
    return EMPTY_PAYMENT_TRANSFER_SETTINGS
  }

  const data = value as Record<string, unknown>

  return {
    bankName: readText(data.bankName),
    accountName: readText(data.accountName),
    accountNumber: readText(data.accountNumber),
    promptPay: readText(data.promptPay),
    branchName: readText(data.branchName),
    instructions: readText(data.instructions),
  }
}

export function hasPaymentTransferSettings(settings: PaymentTransferSettings) {
  return Boolean(settings.bankName || settings.accountName || settings.accountNumber || settings.promptPay)
}
