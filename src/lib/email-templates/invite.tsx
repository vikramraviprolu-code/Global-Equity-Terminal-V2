import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text, Hr,
} from '@react-email/components'
import { main, container, brand, h1, text, link, button, hr, footer } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName, siteUrl, confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
          Accept the invitation to set up your account.
        </Text>
        <Button style={button} href={confirmationUrl}>Accept invitation</Button>
        <Hr style={hr} />
        <Text style={footer}>
          If you weren't expecting this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
