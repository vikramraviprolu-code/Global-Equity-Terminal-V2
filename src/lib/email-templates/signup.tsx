import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text, Hr,
} from '@react-email/components'
import { main, container, brand, h1, text, link, button, hr, footer } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName, siteUrl, recipient, confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Confirm your email</Heading>
        <Text style={text}>
          Thanks for signing up for{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
          Confirm <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>{' '}
          to activate your terminal access.
        </Text>
        <Button style={button} href={confirmationUrl}>Verify email</Button>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
