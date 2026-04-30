/** Client-safe — no Node.js imports */

export const CARRIER_GATEWAYS: Record<string, string> = {
  'AT&T':          'txt.att.net',
  'T-Mobile':      'tmomail.net',
  'Verizon':       'vtext.com',
  'Cricket':       'sms.cricketwireless.net',
  'Boost':         'sms.myboostmobile.com',
  'Metro':         'mymetropcs.com',
  'US Cellular':   'email.uscc.net',
  'Google Fi':     'msg.fi.google.com',
  'Straight Talk': 'vtext.com',
}

export function buildSmsEmail(phone: string, carrier: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^1/, '')
  const domain = CARRIER_GATEWAYS[carrier] ?? ''
  return domain ? `${digits}@${domain}` : ''
}
