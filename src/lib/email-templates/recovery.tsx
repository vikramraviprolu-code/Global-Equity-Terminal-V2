import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from '@react-email/components'
import { main, container, brand, h1, text, button, hr, footer } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName, confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for {siteName}. Click
          below to choose a new one.
        </Text>
        <Button style={button} href={confirmationUrl}>Reset password</Button>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn't request this, you can safely ignore this email — your
          password will not change.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
