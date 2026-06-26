/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  recipient?: string
  token?: string
}

const getSetupUrl = (confirmationUrl: string, recipient?: string) => {
  try {
    const verifyUrl = new URL(confirmationUrl)
    const redirectTo = verifyUrl.searchParams.get('redirect_to') || 'https://zcconsultants.automateplanet.com/sales/set-password'
    const setupUrl = new URL(redirectTo)
    if (recipient) setupUrl.searchParams.set('email', recipient)
    return setupUrl.toString()
  } catch (_error) {
    const setupUrl = new URL('https://zcconsultants.automateplanet.com/sales/set-password')
    if (recipient) setupUrl.searchParams.set('email', recipient)
    return setupUrl.toString()
  }
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
  recipient,
  token,
}: RecoveryEmailProps) => {
  const setupUrl = getSetupUrl(confirmationUrl, recipient)

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Reset your password for Z & C Consultants</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Z & C Consultants</Text>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>
            We received a request to reset your password. Open the setup page and enter this recovery code.
          </Text>
          {token ? <Text style={codeBox}>{token}</Text> : null}
          <Button style={button} href={token ? setupUrl : confirmationUrl}>
            Open password setup
          </Button>
          <Text style={helper}>
            This code expires shortly. If it has expired, request a new setup code from the sign-in page.
          </Text>
          <Text style={footer}>
            If you didn't request this, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Outfit', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const brand = { fontSize: '16px', fontWeight: 'bold' as const, color: 'hsl(199, 89%, 35%)', margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(222, 47%, 11%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 16%, 47%)', lineHeight: '1.6', margin: '0 0 28px' }
const codeBox = { display: 'inline-block', fontSize: '26px', fontWeight: 'bold' as const, letterSpacing: '6px', color: 'hsl(222, 47%, 11%)', backgroundColor: 'hsl(240, 20%, 96%)', border: '1px solid hsl(240, 14%, 90%)', borderRadius: '10px', padding: '14px 18px', margin: '0 0 24px' }
const button = { backgroundColor: 'hsl(199, 89%, 35%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '10px', padding: '12px 24px', textDecoration: 'none' }
const helper = { fontSize: '13px', color: 'hsl(215, 16%, 47%)', lineHeight: '1.6', margin: '24px 0 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
